package app.tablic.desktop;

import app.tablic.core.Room;

/** Runs the Tablić server on a desktop JVM for testing: java DesktopMain <webDir> [port] [skinsDir] */
public final class DesktopMain {
    public static void main(String[] args) throws Exception {
        app.cards.desktop.DesktopMain.run(new Room(), args);
    }
}
