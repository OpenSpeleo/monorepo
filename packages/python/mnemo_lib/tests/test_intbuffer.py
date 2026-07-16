from __future__ import annotations

import unittest

import pytest

from mnemo_lib.intbuffer import IntegerBuffer


class TestIntegerBuffer(unittest.TestCase):
    def setUp(self):
        """Set up a buffer instance for use in each test."""
        self.buffer_data = [5, 68, 89, 101, 23, 11, 8, 0, 35, 66, 48, 48]
        self.buffer = IntegerBuffer(self.buffer_data)

    def test_read_single_element(self):
        """Test reading a single element from the buffer."""
        result = self.buffer.read()
        assert result == 5
        assert self.buffer.cursor == 1

    def test_read_multiple_elements(self):
        """Test reading multiple elements from the buffer."""
        result = self.buffer.read(3)
        assert result == [5, 68, 89]
        assert self.buffer.cursor == 3

    def test_read_beyond_buffer(self):
        """Test reading beyond the buffer size raises IndexError."""
        with pytest.raises(IndexError):
            self.buffer.read(len(self.buffer_data) + 1)

    def test_peek_single_element(self):
        """Test peeking at a single element without moving the cursor."""
        result = self.buffer.peek()
        assert result == [5]
        assert self.buffer.cursor == 0

    def test_peek_multiple_elements(self):
        """Test peeking multiple elements without moving the cursor."""
        result = self.buffer.peek(3)
        assert result == [5, 68, 89]
        assert self.buffer.cursor == 0

    def test_peek_beyond_buffer(self):
        """Test peeking beyond the buffer size raises IndexError."""
        with pytest.raises(IndexError):
            self.buffer.peek(len(self.buffer_data) + 1)

    def test_seek_within_bounds(self):
        """Test seeking to a valid position."""
        self.buffer.seek(5)
        assert self.buffer.cursor == 5

    def test_seek_out_of_bounds(self):
        """Test seeking to an invalid position raises IndexError."""
        with pytest.raises(IndexError):
            self.buffer.seek(len(self.buffer_data) + 1)

    def test_direct_access(self):
        """Test direct access to elements in the buffer."""
        assert self.buffer[2] == 89
        assert self.buffer[-1] == 48

    def test_reset(self):
        """Test resetting the cursor to the beginning of the buffer."""
        self.buffer.read(4)
        self.buffer.reset()
        assert self.buffer.cursor == 0

    def test_len(self):
        """Test the length of the buffer."""
        assert len(self.buffer) == len(self.buffer_data)

    def test_empty_buffer(self):
        """Test behavior with an empty buffer."""
        empty_buffer = IntegerBuffer([])
        with pytest.raises(IndexError):
            empty_buffer.read()

        with pytest.raises(IndexError):
            empty_buffer.peek()

        assert len(empty_buffer) == 0

    def test_invalid_buffer_type(self):
        """Test initializing the buffer with a non-list object raises ValueError."""
        with pytest.raises(TypeError):
            IntegerBuffer("not a list")  # pyright: ignore[reportArgumentType]

    def test_negative_peek(self):
        """Test peeking with negative items raises IndexError."""
        with pytest.raises(IndexError):
            self.buffer.peek(-3)

    def test_negative_read(self):
        """Test reading with negative items raises IndexError."""
        with pytest.raises(ValueError, match="Can not fetch 0 or negative items"):
            self.buffer.read(-2)

    def test_read_entire_buffer(self):
        """Test reading the entire buffer."""
        result = self.buffer.read(len(self.buffer_data))
        assert result == self.buffer_data
        assert self.buffer.cursor == len(self.buffer_data)

    def test_cursor_after_direct_access(self):
        """Test that direct access does not move the cursor."""
        _ = self.buffer[2]
        assert self.buffer.cursor == 0

    def test_iteration(self):
        """Test reading elements sequentially to the end of the buffer."""
        for expected_value in self.buffer_data:
            assert self.buffer.read() == expected_value
        assert self.buffer.cursor == len(self.buffer_data)

    def test_multiple_resets(self):
        """Test multiple resets do not affect buffer data."""
        self.buffer.read(5)
        self.buffer.reset()
        self.buffer.read(2)
        assert self.buffer[0] == 5

    def test_invalid_buffer_type_string(self):
        """Test initializing the buffer with a string raises TypeError."""
        with pytest.raises(TypeError):
            IntegerBuffer("not a list")

    def test_invalid_buffer_type_mixed_list(self):
        """Test initializing the buffer with a list containing non-integers raises
        TypeError."""
        with pytest.raises(TypeError):
            IntegerBuffer([1, "two", 3.5, 4])
