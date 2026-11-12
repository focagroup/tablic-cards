package app.tablic;

import android.graphics.Color;

import java.util.UUID;

import app.cards.android.CardsActivity;
import app.cards.core.GameInfo;
import app.tablic.core.Room;

/** Tablić on the cards framework: everything but the game's identity lives in {@link CardsActivity}. */
public class MainActivity extends CardsActivity {
    /** Unique per game, so a Tablić guest never connects to another game's host. */
    private static final UUID BT_SERVICE = UUID.fromString("b81d4e07-3c2a-4f95-8e6d-27a9c4f05b3e");

    @Override protected GameInfo info() { return Room.INFO; }

    @Override protected Room createRoom() { return new Room(); }

    @Override protected UUID bluetoothService() { return BT_SERVICE; }

    @Override protected int pageColor() { return Color.rgb(15, 61, 102); }

    @Override protected int frameColor() { return Color.rgb(10, 40, 71); }

    @Override protected String exitQuestion() { return "Izaći? / Изаћи? / Выйти? / Exit? / Beenden?"; }
}
