package app.tablic.core;

import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URLDecoder;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Tiny dependency-free HTTP/1.0-style server for the local network only.
 * Serves the web client from an AssetSource and a small JSON API backed by a Room.
 * Requests from the loopback interface (the host phone's own WebView) get host rights.
 * A server with a {@link Forwarder} serves the web client locally but passes every API call
 * on to another server (used by a Bluetooth guest: the game runs on the host phone).
 */
public final class WebServer {

    public interface AssetSource {
        /** Returns file bytes for a path like "index.html", or null if missing. */
        byte[] read(String path) throws IOException;
    }

    /** Handles API calls somewhere else instead of in a local Room. */
    public interface Forwarder {
        Response forward(String method, String target, byte[] body) throws IOException;
    }

    public static final class Response {
        public final int code;
        public final String type;
        public final byte[] data;
        public Response(int code, String type, byte[] data) {
            this.code = code;
            this.type = type;
            this.data = data;
        }
    }

    private static final int MAX_HEADER = 16 * 1024;
    public static final int MAX_BODY = 16 * 1024;
    public static final long POLL_MS = 20000;

    private final Room room;
    private final AssetSource assets;
    private final ExecutorService pool = Executors.newCachedThreadPool();
    private volatile Forwarder forwarder;
    private ServerSocket server;
    private volatile boolean running;
    private int port;

    public WebServer(Room room, AssetSource assets) {
        this.room = room;
        this.assets = assets;
    }

    public void setForwarder(Forwarder f) { forwarder = f; }

    /** Binds to the first free port starting at `preferred` and starts accepting. */
    public synchronized int start(int preferred) throws IOException {
        return start(preferred, false);
    }

    /** Like {@link #start(int)}; with loopbackOnly the port is reachable from this device only. */
    public synchronized int start(int preferred, boolean loopbackOnly) throws IOException {
        if (running) return port;
        IOException last = null;
        for (int p = preferred; p < preferred + 20; p++) {
            try {
                ServerSocket ss = new ServerSocket();
                ss.setReuseAddress(true);
                // Explicit 127.0.0.1: on Android getLoopbackAddress() is ::1, but the WebView loads 127.0.0.1.
                ss.bind(loopbackOnly ? new InetSocketAddress(InetAddress.getByAddress(new byte[]{127, 0, 0, 1}), p)
                        : new InetSocketAddress(p), 32);
                server = ss;
                port = p;
                break;
            } catch (IOException e) {
                last = e;
            }
        }
        if (server == null) throw last != null ? last : new IOException("no port");
        running = true;
        Thread t = new Thread(new Runnable() {
            @Override public void run() { acceptLoop(); }
        }, "tablic-http");
        t.setDaemon(true);
        t.start();
        return port;
    }

    public int port() { return port; }

    public synchronized void stop() {
        running = false;
        try { if (server != null) server.close(); } catch (IOException ignored) {}
        server = null;
    }

    private void acceptLoop() {
        while (running) {
            try {
                final Socket s = server.accept();
                pool.execute(new Runnable() {
                    @Override public void run() { handle(s); }
                });
            } catch (IOException e) {
                if (!running) return;
            }
        }
    }

    /** Non-loopback IPv4 addresses of this device (Wi-Fi, hotspot, ethernet). */
    public static List<String> localAddresses() {
        List<String> out = new ArrayList<>();
        try {
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                for (InetAddress a : Collections.list(ni.getInetAddresses())) {
                    if (a instanceof Inet4Address && !a.isLoopbackAddress()) out.add(a.getHostAddress());
                }
            }
        } catch (Exception ignored) {}
        return out;
    }

    // ------------------------------------------------------------------ request handling

    private void handle(Socket s) {
        try {
            s.setSoTimeout(30000);
            InputStream in = new BufferedInputStream(s.getInputStream());
            String head = readHead(in);
            if (head == null) return;
            String[] lines = head.split("\r\n");
            String[] req = lines[0].split(" ");
            if (req.length < 2) return;
            String method = req[0];
            String target = req[1];
            int contentLength = 0;
            for (int i = 1; i < lines.length; i++) {
                int c = lines[i].indexOf(':');
                if (c > 0 && lines[i].substring(0, c).trim().equalsIgnoreCase("content-length"))
                    contentLength = Room.parseInt(lines[i].substring(c + 1), 0);
            }
            if (contentLength > MAX_BODY) { send(s, 413, "text/plain", bytes("too large")); return; }
            byte[] body = new byte[contentLength];
            int read = 0;
            while (read < contentLength) {
                int r = in.read(body, read, contentLength - read);
                if (r < 0) break;
                read += r;
            }
            if (read < contentLength) body = Arrays.copyOf(body, read);
            boolean isHost = s.getInetAddress().isLoopbackAddress();
            Response r = respond(method, target, body, isHost);
            send(s, r.code, r.type, r.data);
        } catch (Exception e) {
            // client went away or sent garbage; nothing to do
        } finally {
            try { s.close(); } catch (IOException ignored) {}
        }
    }

    /**
     * Answers one request. Also called directly for requests that arrive over Bluetooth
     * (with isHost = false), so it must not depend on how the request was transported.
     */
    public Response respond(String method, String target, byte[] body, boolean isHost) throws IOException {
        String path = target;
        int q = target.indexOf('?');
        if (q >= 0) path = target.substring(0, q);
        if (path.startsWith("/api/")) {
            Forwarder f = forwarder;
            if (f != null) {
                try {
                    return f.forward(method, target, body);
                } catch (IOException e) {
                    return new Response(503, "application/json", bytes("{\"ok\":false,\"error\":\"offline\"}"));
                }
            }
            Map<String, String> params = new HashMap<>();
            if (q >= 0) parseForm(target.substring(q + 1), params);
            if ("POST".equals(method)) parseForm(new String(body, "UTF-8"), params);
            return api(path.substring(5), params, isHost);
        }
        if ("GET".equals(method)) return serveAsset(path);
        return new Response(405, "text/plain", bytes("method not allowed"));
    }

    private Response api(String action, Map<String, String> p, boolean isHost) {
        String token = p.get("token");
        String err;
        switch (action) {
            case "state": {
                long since = parseLong(p.get("since"));
                room.awaitChange(since, POLL_MS);
                String json = room.state(token, isHost, isHost ? localAddresses() : null, port);
                return new Response(200, "application/json; charset=utf-8", bytes(json));
            }
            case "config": err = room.configure(isHost, p); break;
            case "join": err = room.join(token, Room.parseInt(p.get("seat"), -1), p.get("name")); break;
            case "leave": err = room.leave(token); break;
            case "start": err = room.start(isHost); break;
            case "next": err = room.nextRound(isHost); break;
            case "end": err = room.endGame(isHost); break;
            case "seat": err = room.setSeatType(isHost, Room.parseInt(p.get("seat"), -1), p.get("type")); break;
            case "play": {
                int[] cap = parseIds(p.get("capture"));
                err = room.play(token, isHost, Room.parseInt(p.get("seat"), -1), Room.parseInt(p.get("card"), -1), cap);
                break;
            }
            default:
                return new Response(404, "application/json", bytes("{\"error\":\"unknown\"}"));
        }
        String json = err == null ? "{\"ok\":true}" : "{\"ok\":false,\"error\":\"" + err + "\"}";
        return new Response(200, "application/json; charset=utf-8", bytes(json));
    }

    private Response serveAsset(String path) throws IOException {
        if (path.equals("/") || path.isEmpty()) path = "/index.html";
        if (!path.startsWith("/")) return new Response(404, "text/plain", bytes("not found"));
        path = path.substring(1);
        if (path.contains("..") || path.contains("\\") || path.startsWith("/")) {
            return new Response(404, "text/plain", bytes("not found"));
        }
        byte[] data = assets.read(path);
        if (data == null) return new Response(404, "text/plain", bytes("not found"));
        return new Response(200, mime(path), data);
    }

    // ------------------------------------------------------------------ http helpers

    private static String readHead(InputStream in) throws IOException {
        ByteArrayOutputStream buf = new ByteArrayOutputStream();
        int state = 0;
        while (true) {
            int b = in.read();
            if (b < 0) return null;
            buf.write(b);
            if (buf.size() > MAX_HEADER) return null;
            if ((state == 0 || state == 2) && b == '\r') state++;
            else if (state == 1 && b == '\n') state = 2;
            else if (state == 3 && b == '\n') break;
            else state = 0;
        }
        String h = buf.toString("ISO-8859-1");
        return h.substring(0, h.length() - 4);
    }

    private static void send(Socket s, int code, String type, byte[] data) throws IOException {
        String status = code == 200 ? "OK" : code == 404 ? "Not Found" : code == 503 ? "Unavailable" : "Error";
        String head = "HTTP/1.1 " + code + " " + status + "\r\n"
                + "Content-Type: " + type + "\r\n"
                + "Content-Length: " + data.length + "\r\n"
                // Card images never change while the app runs: let the WebView keep them, otherwise each
                // re-render re-fetches every card and they flash blank on slower devices.
                + "Cache-Control: " + (type.startsWith("image/") ? "max-age=86400" : "no-store") + "\r\n"
                + "X-Content-Type-Options: nosniff\r\n"
                + "Connection: close\r\n\r\n";
        OutputStream out = s.getOutputStream();
        out.write(head.getBytes("ISO-8859-1"));
        out.write(data);
        out.flush();
    }

    private static void parseForm(String s, Map<String, String> into) {
        for (String kv : s.split("&")) {
            if (kv.isEmpty()) continue;
            int e = kv.indexOf('=');
            try {
                String k = URLDecoder.decode(e < 0 ? kv : kv.substring(0, e), "UTF-8");
                String v = e < 0 ? "" : URLDecoder.decode(kv.substring(e + 1), "UTF-8");
                into.put(k, v);
            } catch (Exception ignored) {}
        }
    }

    private static int[] parseIds(String s) {
        if (s == null || s.trim().isEmpty()) return new int[0];
        String[] parts = s.split(",");
        int[] out = new int[parts.length];
        for (int i = 0; i < parts.length; i++) out[i] = Room.parseInt(parts[i], -1);
        return out;
    }

    private static long parseLong(String s) {
        try { return Long.parseLong(s); } catch (Exception e) { return 0; }
    }

    private static byte[] bytes(String s) {
        try { return s.getBytes("UTF-8"); } catch (Exception e) { return new byte[0]; }
    }

    private static String mime(String path) {
        if (path.endsWith(".html")) return "text/html; charset=utf-8";
        if (path.endsWith(".js")) return "application/javascript; charset=utf-8";
        if (path.endsWith(".css")) return "text/css; charset=utf-8";
        if (path.endsWith(".svg")) return "image/svg+xml";
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".json")) return "application/json";
        return "application/octet-stream";
    }
}
