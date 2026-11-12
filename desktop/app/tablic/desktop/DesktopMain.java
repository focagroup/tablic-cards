package app.tablic.desktop;

import java.io.File;
import java.nio.file.Files;

import app.tablic.core.Room;
import app.tablic.core.WebServer;

/** Runs the same server on a desktop JVM for testing: java DesktopMain <webDir> [port] [skinsDir] */
public final class DesktopMain {
    public static void main(String[] args) throws Exception {
        final File web = new File(args.length > 0 ? args[0] : "app/assets/web").getCanonicalFile();
        int port = args.length > 1 ? Integer.parseInt(args[1]) : 8080;
        final File skins = new File(args.length > 2 ? args[2] : "skins").getCanonicalFile();
        WebServer ws = new WebServer(new Room(), new WebServer.AssetSource() {
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
        });
        int p = ws.start(port);
        System.out.println("Tablić server on port " + p + "  addresses: " + WebServer.localAddresses());
        Thread.currentThread().join();
    }
}
