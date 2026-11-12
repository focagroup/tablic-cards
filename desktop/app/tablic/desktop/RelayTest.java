package app.tablic.desktop;

import java.io.File;
import java.io.IOException;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.file.Files;

import app.tablic.core.Relay;
import app.tablic.core.Room;
import app.tablic.core.WebServer;

/**
 * Tests the Bluetooth relay with TCP standing in for RFCOMM: a host server, a relay listener,
 * and a guest proxy that forwards API calls through the relay.
 *   java RelayTest            -> automated checks
 *   java RelayTest serve      -> also keep running: host http://localhost:8080, guest http://localhost:8081
 */
public final class RelayTest {
    private static int failures;

    public static void main(String[] args) throws Exception {
        final File web = new File("app/assets/web").getCanonicalFile();
        final File skins = new File("skins").getCanonicalFile();
        WebServer.AssetSource assets = new WebServer.AssetSource() {
            @Override public byte[] read(String path) {
                try {
                    File root = web;
                    if (path.startsWith("skins/")) { root = skins; path = path.substring(6); }
                    File f = new File(root, path).getCanonicalFile();
                    if (!f.getPath().startsWith(root.getPath() + File.separator) || !f.isFile()) return null;
                    return Files.readAllBytes(f.toPath());
                } catch (Exception e) {
                    return null;
                }
            }
        };
        boolean serve = args.length > 0 && args[0].equals("serve");

        final WebServer host = new WebServer(new Room(), assets);
        int hostPort = host.start(serve ? 8080 : 18080);

        final ServerSocket link = new ServerSocket(0, 8, InetAddress.getLoopbackAddress());
        final int linkPort = link.getLocalPort();
        final Socket[] lastHostSide = new Socket[1];
        Thread acc = new Thread(new Runnable() {
            @Override public void run() {
                while (true) {
                    try {
                        final Socket s = link.accept();
                        lastHostSide[0] = s;
                        new Thread(new Runnable() {
                            @Override public void run() {
                                try { Relay.serve(s.getInputStream(), s.getOutputStream(), host); }
                                catch (IOException ignored) {}
                                try { s.close(); } catch (IOException ignored) {}
                            }
                        }).start();
                    } catch (IOException e) {
                        return;
                    }
                }
            }
        });
        acc.setDaemon(true);
        acc.start();

        Relay.Connector connector = new Relay.Connector() {
            @Override public Relay.Client connect() throws IOException {
                Socket s = new Socket(InetAddress.getLoopbackAddress(), linkPort);
                return new Relay.Client(s.getInputStream(), s.getOutputStream(), s);
            }
        };
        Relay.Link fwd = new Relay.Link(connector, connector.connect());
        WebServer guest = new WebServer(null, assets);
        guest.setForwarder(fwd);
        int guestPort = guest.start(serve ? 8081 : 18081, true);

        // Host makes seat 1 remote; guest (through the relay) must not have host rights.
        check(post(hostPort, "config", "seat1_type=remote").contains("\"ok\":true"), "host can configure");
        String gs = get(guestPort, "/api/state?token=guesttoken0000001&since=0");
        check(gs.contains("\"isHost\":false"), "guest is not host: " + snip(gs));
        check(!get(hostPort, "/api/state?token=x&since=0").contains("\"isHost\":false"), "host is host");
        check(post(guestPort, "config", "token=guesttoken0000001&players=4").contains("host_only"), "guest cannot configure");
        check(post(guestPort, "start", "token=guesttoken0000001").contains("host_only"), "guest cannot start");
        check(post(guestPort, "join", "token=guesttoken0000001&seat=1&name=Blue").contains("\"ok\":true"), "guest joins seat 1");
        check(get(hostPort, "/api/state?token=x&since=0").contains("Blue"), "host sees guest name");
        check(get(guestPort, "/index.html").contains("<title>"), "guest serves assets locally");

        // A long poll and a move at the same time over one link.
        final int gp = guestPort;
        final long v = Long.parseLong(gs.replaceAll("(?s).*\"v\":(\\d+).*", "$1"));
        final String[] polled = new String[1];
        Thread poller = new Thread(new Runnable() {
            @Override public void run() {
                try { polled[0] = get(gp, "/api/state?token=guesttoken0000001&since=" + (v + 1)); }
                catch (IOException e) { polled[0] = "ERR " + e; }
            }
        });
        poller.start();
        Thread.sleep(300);
        long t0 = System.currentTimeMillis();
        check(post(hostPort, "start", "").contains("\"ok\":true"), "host starts game");
        poller.join(5000);
        check(polled[0] != null && polled[0].contains("\"phase\":\"playing\""), "long poll wakes up on start: " + snip(polled[0]));
        check(System.currentTimeMillis() - t0 < 3000, "long poll answer is quick");

        // Drop the link: guest gets 503, then reconnects by itself.
        lastHostSide[0].close();
        Thread.sleep(200);
        int code = status(guestPort, "/api/state?token=guesttoken0000001&since=0");
        check(code == 503 || code == 200, "after drop: " + code);
        Thread.sleep(3200);
        String again = get(guestPort, "/api/state?token=guesttoken0000001&since=0");
        check(again.contains("\"isHost\":false") && again.contains("playing"), "reconnected: " + snip(again));
        check(fwd.isConnected(), "link reports connected");

        System.out.println(failures == 0 ? "RELAY OK" : "RELAY FAILURES: " + failures);
        if (serve) {
            System.out.println("host  http://localhost:" + hostPort + "   guest http://localhost:" + guestPort);
            Thread.currentThread().join();
        }
        System.exit(failures == 0 ? 0 : 1);
    }

    private static String snip(String s) {
        return s == null ? "null" : s.length() > 160 ? s.substring(0, 160) + "…" : s;
    }

    private static void check(boolean ok, String what) {
        System.out.println((ok ? "  ok   " : "  FAIL ") + what);
        if (!ok) failures++;
    }

    private static String post(int port, String action, String body) throws IOException {
        return http(port, "POST", "/api/" + action, body)[1];
    }

    private static String get(int port, String path) throws IOException {
        return http(port, "GET", path, "")[1];
    }

    private static int status(int port, String path) throws IOException {
        return Integer.parseInt(http(port, "GET", path, "")[0]);
    }

    private static String[] http(int port, String method, String path, String body) throws IOException {
        Socket s = new Socket(InetAddress.getByAddress(new byte[]{127, 0, 0, 1}), port); // what the WebView uses
        try {
            s.setSoTimeout(30000);
            byte[] b = body.getBytes("UTF-8");
            String req = method + " " + path + " HTTP/1.1\r\nHost: x\r\nContent-Length: " + b.length + "\r\n\r\n";
            s.getOutputStream().write(req.getBytes("ISO-8859-1"));
            s.getOutputStream().write(b);
            s.getOutputStream().flush();
            java.io.ByteArrayOutputStream buf = new java.io.ByteArrayOutputStream();
            byte[] tmp = new byte[8192];
            int n;
            while ((n = s.getInputStream().read(tmp)) > 0) buf.write(tmp, 0, n);
            String r = new String(buf.toByteArray(), "UTF-8");
            String code = r.substring(9, 12);
            int i = r.indexOf("\r\n\r\n");
            return new String[]{code, i < 0 ? "" : r.substring(i + 4)};
        } finally {
            s.close();
        }
    }
}
