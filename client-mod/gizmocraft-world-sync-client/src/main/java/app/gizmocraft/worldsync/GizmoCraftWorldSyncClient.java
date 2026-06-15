package app.gizmocraft.worldsync;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.loader.api.FabricLoader;

import java.io.IOException;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public final class GizmoCraftWorldSyncClient implements ClientModInitializer {
    private static final String CLIENT_VERSION = "0.2.2";
    private static final String WORLD_MAP_URL = "https://gizmocraft-dashboard.vercel.app/api/world-map";
    private static final String TELEMETRY_URL = "https://gizmocraft-dashboard.vercel.app/api/world-map/telemetry";
    private static final String BLISS_SHADER_URL = "https://gizmocraft-dashboard.vercel.app/downloads/gizmocraft-world-sync-modpack/shaderpacks/Bliss_v2.1.2_%28Chocapic13_Shaders_edit%29.zip";
    private static final String BLISS_SHADER_FILE = "Bliss_v2.1.2_(Chocapic13_Shaders_edit).zip";
    private static final String BLISS_SHADER_SHA512 = "dafc60be4980ec40f40edc0f2625cb0976f3c9ce5ed86383146a120480826bb1de70ef5e38b7f1437294ed4d38c6ef3c82ebef0ae4e00b8cee165788c9c18280";
    private static final int HEARTBEAT_SECONDS = 5;
    private static final Set<String> visitedChunks = new HashSet<>();
    private static final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor((task) -> {
        Thread thread = new Thread(task, "gizmocraft-world-sync");
        thread.setDaemon(true);
        return thread;
    });

    @Override
    public void onInitializeClient() {
        Path gameDir = FabricLoader.getInstance().getGameDir();
        Path cacheDir = gameDir.resolve("gizmocraft-world-sync");
        scheduler.execute(() -> installBlissShaderPack(gameDir, cacheDir));
        scheduler.execute(() -> syncWorldMap(cacheDir));
        scheduler.scheduleAtFixedRate(() -> sendHeartbeat(cacheDir), 8, HEARTBEAT_SECONDS, TimeUnit.SECONDS);
    }

    private static HttpClient httpClient() {
        return HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NORMAL).build();
    }

    private static void installBlissShaderPack(Path gameDir, Path cacheDir) {
        Path shaderpacksDir = gameDir.resolve("shaderpacks");
        Path blissFile = shaderpacksDir.resolve(BLISS_SHADER_FILE);
        Path statusFile = cacheDir.resolve("shaderpack-status.txt");
        try {
            Files.createDirectories(shaderpacksDir);
            Files.createDirectories(cacheDir);
            if (Files.isRegularFile(blissFile) && BLISS_SHADER_SHA512.equalsIgnoreCase(sha512(blissFile))) {
                Files.writeString(statusFile, "Bliss Shaders already installed: " + blissFile + "\nVerified: " + Instant.now() + "\n", StandardCharsets.UTF_8);
                System.out.println("[GizmoCraft World Sync] Bliss Shaders already installed at " + blissFile);
                return;
            }

            HttpRequest request = HttpRequest.newBuilder(URI.create(BLISS_SHADER_URL))
                    .header("User-Agent", "GizmoCraftWorldSyncClient/" + CLIENT_VERSION)
                    .GET()
                    .build();
            HttpResponse<byte[]> response = httpClient().send(request, HttpResponse.BodyHandlers.ofByteArray());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                Files.writeString(statusFile, "Bliss Shaders auto-install failed: HTTP " + response.statusCode() + " at " + Instant.now() + "\n", StandardCharsets.UTF_8);
                System.out.println("[GizmoCraft World Sync] Bliss shader download HTTP " + response.statusCode());
                return;
            }

            Path temporaryFile = shaderpacksDir.resolve(BLISS_SHADER_FILE + ".tmp");
            Files.write(temporaryFile, response.body());
            String digest = sha512(temporaryFile);
            if (!BLISS_SHADER_SHA512.equalsIgnoreCase(digest)) {
                Files.deleteIfExists(temporaryFile);
                Files.writeString(statusFile, "Bliss Shaders auto-install failed: SHA-512 mismatch at " + Instant.now() + "\nExpected: " + BLISS_SHADER_SHA512 + "\nActual: " + digest + "\n", StandardCharsets.UTF_8);
                System.out.println("[GizmoCraft World Sync] Bliss shader SHA-512 mismatch");
                return;
            }

            Files.move(temporaryFile, blissFile, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
            Files.writeString(statusFile, "Bliss Shaders auto-installed: " + blissFile + "\nSource: " + BLISS_SHADER_URL + "\nInstalled: " + Instant.now() + "\n", StandardCharsets.UTF_8);
            System.out.println("[GizmoCraft World Sync] Auto-installed Bliss Shaders at " + blissFile);
        } catch (IOException | InterruptedException error) {
            if (error instanceof InterruptedException) Thread.currentThread().interrupt();
            System.out.println("[GizmoCraft World Sync] Bliss shader auto-install failed: " + error.getMessage());
        }
    }

    private static String sha512(Path path) throws IOException {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-512");
            try (java.io.InputStream input = Files.newInputStream(path)) {
                byte[] buffer = new byte[8192];
                int read;
                while ((read = input.read(buffer)) != -1) digest.update(buffer, 0, read);
            }
            return HexFormat.of().formatHex(digest.digest());
        } catch (java.security.NoSuchAlgorithmException error) {
            throw new IOException("SHA-512 unavailable", error);
        }
    }

    private static void syncWorldMap(Path cacheDir) {
        try {
            Files.createDirectories(cacheDir);
            HttpRequest request = HttpRequest.newBuilder(URI.create(WORLD_MAP_URL))
                    .header("User-Agent", "GizmoCraftWorldSyncClient/" + CLIENT_VERSION)
                    .GET()
                    .build();
            HttpResponse<String> response = httpClient().send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            Path statusFile = cacheDir.resolve("status.txt");
            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                Files.writeString(cacheDir.resolve("latest-world-map.json"), response.body(), StandardCharsets.UTF_8);
                Files.writeString(statusFile, "Last GizmoCraft world-map sync: " + Instant.now() + "\nSource: " + WORLD_MAP_URL + "\nLive heartbeat: " + TELEMETRY_URL + " every " + HEARTBEAT_SECONDS + "s\n", StandardCharsets.UTF_8);
                System.out.println("[GizmoCraft World Sync] Cached latest world map at " + cacheDir);
            } else {
                Files.writeString(statusFile, "GizmoCraft world-map sync failed: HTTP " + response.statusCode() + " at " + Instant.now() + "\n", StandardCharsets.UTF_8);
                System.out.println("[GizmoCraft World Sync] HTTP " + response.statusCode());
            }
        } catch (IOException | InterruptedException error) {
            if (error instanceof InterruptedException) Thread.currentThread().interrupt();
            System.out.println("[GizmoCraft World Sync] Failed: " + error.getMessage());
        }
    }

    private static void sendHeartbeat(Path cacheDir) {
        try {
            PlayerSnapshot snapshot = readPlayerSnapshot();
            if (snapshot == null) return;
            visitedChunks.add(snapshot.chunkX + ":" + snapshot.chunkZ);
            String payload = buildTelemetryJson(snapshot);
            HttpRequest request = HttpRequest.newBuilder(URI.create(TELEMETRY_URL))
                    .header("User-Agent", "GizmoCraftWorldSyncClient/" + CLIENT_VERSION)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(payload, StandardCharsets.UTF_8))
                    .build();
            HttpResponse<String> response = httpClient().send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            Files.createDirectories(cacheDir);
            Files.writeString(cacheDir.resolve("latest-heartbeat.json"), payload + "\nHTTP " + response.statusCode() + " at " + Instant.now() + "\n", StandardCharsets.UTF_8);
            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                System.out.println("[GizmoCraft World Sync] Sent live position " + snapshot.name + " @ " + snapshot.x + "," + snapshot.y + "," + snapshot.z);
            } else {
                System.out.println("[GizmoCraft World Sync] Heartbeat HTTP " + response.statusCode());
            }
        } catch (Throwable error) {
            System.out.println("[GizmoCraft World Sync] Heartbeat failed: " + error.getMessage());
        }
    }

    private static PlayerSnapshot readPlayerSnapshot() throws Exception {
        Object client = callStatic("net.minecraft.class_310", "method_1551");
        if (client == null) return null;
        Object player = readField(client, "field_1724");
        if (player == null) return null;
        double x = ((Number) callMapped(player, "net.minecraft.class_1297", "method_23317", "()D")).doubleValue();
        double y = ((Number) callMapped(player, "net.minecraft.class_1297", "method_23318", "()D")).doubleValue();
        double z = ((Number) callMapped(player, "net.minecraft.class_1297", "method_23321", "()D")).doubleValue();
        String uuid = String.valueOf(callMapped(player, "net.minecraft.class_1297", "method_5667", "()Ljava/lang/String;"));
        String name = readPlayerName(player);
        return new PlayerSnapshot(name, uuid, x, y, z, (int)Math.floor(x / 16.0), (int)Math.floor(z / 16.0));
    }

    private static String readPlayerName(Object player) {
        try {
            Object profile = callMapped(player, "net.minecraft.class_1657", "method_7334", "()Lcom/mojang/authlib/GameProfile;");
            Object name = profile.getClass().getMethod("getName").invoke(profile);
            if (name != null) return sanitizeName(String.valueOf(name));
        } catch (Throwable ignored) {}
        return "unknown";
    }

    private static Object callStatic(String intermediaryClassName, String intermediaryMethodName) throws Exception {
        Class<?> type = Class.forName(mapClass(intermediaryClassName));
        Method method = type.getDeclaredMethod(mapMethod(intermediaryClassName, intermediaryMethodName, "()L" + intermediaryClassName.replace('.', '/') + ";"));
        method.setAccessible(true);
        return method.invoke(null);
    }

    private static Object callMapped(Object target, String owner, String intermediaryMethodName, String descriptor) throws Exception {
        Method method = findMethod(target.getClass(), intermediaryMethodName, mapMethod(owner, intermediaryMethodName, descriptor));
        method.setAccessible(true);
        return method.invoke(target);
    }

    private static Method findMethod(Class<?> type, String... candidateNames) throws NoSuchMethodException {
        for (String candidateName : candidateNames) {
            for (Method method : type.getMethods()) if (method.getName().equals(candidateName)) return method;
            for (Method method : type.getDeclaredMethods()) if (method.getName().equals(candidateName)) return method;
        }
        throw new NoSuchMethodException(String.join(",", candidateNames));
    }

    private static Object readField(Object target, String intermediaryFieldName) throws Exception {
        String mapped = mapField("net.minecraft.class_310", intermediaryFieldName, "Lnet/minecraft/class_746;");
        Field field = target.getClass().getDeclaredField(mapped);
        field.setAccessible(true);
        return field.get(target);
    }

    private static String mapClass(String intermediaryName) {
        return FabricLoader.getInstance().getMappingResolver().mapClassName("intermediary", intermediaryName);
    }

    private static String mapMethod(String owner, String name, String descriptor) {
        return FabricLoader.getInstance().getMappingResolver().mapMethodName("intermediary", owner, name, descriptor);
    }

    private static String mapField(String owner, String name, String descriptor) {
        return FabricLoader.getInstance().getMappingResolver().mapFieldName("intermediary", owner, name, descriptor);
    }

    private static String buildTelemetryJson(PlayerSnapshot snapshot) {
        StringBuilder chunks = new StringBuilder();
        int count = 0;
        for (String id : visitedChunks) {
            if (count++ > 0) chunks.append(',');
            String[] parts = id.split(":", 2);
            chunks.append("{\"chunkX\":").append(parts[0]).append(",\"chunkZ\":").append(parts[1]).append('}');
            if (count >= 96) break;
        }
        return "{\"player\":{"
                + "\"name\":\"" + escapeJson(snapshot.name) + "\","
                + "\"uuid\":\"" + escapeJson(snapshot.uuid) + "\","
                + "\"x\":" + snapshot.x + ","
                + "\"y\":" + snapshot.y + ","
                + "\"z\":" + snapshot.z + ","
                + "\"chunkX\":" + snapshot.chunkX + ","
                + "\"chunkZ\":" + snapshot.chunkZ
                + "},\"visitedChunks\":[" + chunks + "]}";
    }

    private static String sanitizeName(String value) {
        String name = value == null ? "unknown" : value.trim();
        return name.matches("[A-Za-z0-9_]{1,16}") ? name : "unknown";
    }

    private static String escapeJson(String value) {
        return String.valueOf(value == null ? "" : value).replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private record PlayerSnapshot(String name, String uuid, double x, double y, double z, int chunkX, int chunkZ) {}
}
