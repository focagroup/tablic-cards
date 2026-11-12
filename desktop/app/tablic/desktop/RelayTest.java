package app.tablic.desktop;

import app.tablic.core.Room;

/** Bluetooth relay checks for Tablić over TCP (see app.cards.desktop.RelayTest). */
public final class RelayTest {
    public static void main(String[] args) throws Exception {
        app.cards.desktop.RelayTest.run(new Room(), args);
    }
}
