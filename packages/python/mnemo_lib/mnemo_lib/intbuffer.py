from __future__ import annotations

from typing import TYPE_CHECKING
from typing import overload

if TYPE_CHECKING:
    from types import NoneType


class IntegerBuffer:
    def __init__(self, buffer: list[int]) -> None:
        if not isinstance(buffer, list) or any(  # pyright: ignore[reportUnnecessaryIsInstance]
            not isinstance(item, int)  # pyright: ignore[reportUnnecessaryIsInstance]
            for item in buffer
        ):
            raise TypeError("Buffer must be a list of integers.")

        self.buffer = tuple(buffer)  # Tuple to guarantee immutability
        self.cursor = 0

    @overload
    def read(self) -> int: ...

    @overload
    def read(self, n_items: NoneType) -> int: ...

    @overload
    def read(self, n_items: int) -> list[int]: ...

    def read(self, n_items: int | None = None) -> int | list[int]:
        """
        Read `items` integers from the current cursor position and move the cursor.
        """
        match n_items:
            case None:
                self.cursor += 1
                return self.buffer[self.cursor - 1 : self.cursor][0]

            case int():
                if n_items <= 0:
                    raise ValueError("Can not fetch 0 or negative items.")

                if self.cursor + n_items > len(self.buffer):
                    raise IndexError("Reading beyond the buffer.")

                values = self.buffer[self.cursor : self.cursor + n_items]
                self.cursor += n_items

                return list(values)

            case _:
                raise TypeError(f"Unknown type received: {type(n_items)} ...")

    def readInt16BE(self) -> float:  # noqa: N802
        lsb: int = self.read()  # pyright: ignore[reportCallIssue]
        msb: int = self.read()  # pyright: ignore[reportCallIssue]

        # ---- old method ---- #
        # if msb < 0:
        #     msb = 2**8 + msb
        #
        # return lsb * 2**8 + msb
        # -------------------- #
        return (lsb * 2**8) + (msb & 0xFF)

    def peek(self, items: int = 1) -> list[int]:
        """
        Peek `items` integers without moving the cursor.
        """
        if self.cursor + items > len(self.buffer):
            raise IndexError("Peeking beyond the buffer.")

        if items <= 0:
            raise IndexError("Can not fetch 0 or negative items.")

        return list(self.buffer[self.cursor : self.cursor + items])

    def seek(self, index: int) -> None:
        """
        Move the cursor to the specified position.
        """
        if not (0 <= index < len(self.buffer)):
            raise IndexError("Seek position out of range.")

        self.cursor = index

    def reset(self) -> None:
        """Reset the cursor to the start of the buffer."""
        self.cursor = 0

    def __getitem__(self, index: int) -> int:
        """
        Direct access to the buffer.
        """
        return self.buffer[index]

    def __len__(self) -> int:
        """Return the length of the buffer."""
        return len(self.buffer)
