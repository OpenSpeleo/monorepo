from __future__ import annotations

import statistics
import weakref
from functools import cached_property
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ariane_lib.shot import SurveyShot


def rounded_property(decimal):
    def decorator(func):
        @property
        def wrapper(instance):
            val = round(func(instance), decimal)
            return int(val) if decimal == 0 else val

        return wrapper

    return decorator


class SurveySection:
    def __init__(self, shot: SurveyShot) -> None:
        self._shots = []
        self._name = shot.section
        self.add_shot(shot)

    def __len__(self):
        return len(self._shots)

    def __repr__(self) -> str:
        repr_str = f"[{self.__class__.__name__}] `{self.name}`"
        repr_str += f"\n\t- Total Shots: {len(self)}"
        repr_str += f"\n\t- Total Length: {self.length}"

        repr_str += f"\n\t- Max Shot Length: {self.max_shot_length}"
        repr_str += f"\n\t- Min Shot Length: {self.min_shot_length}"
        repr_str += f"\n\t- Avg Shot Length: {self.avg_shot_length}"
        repr_str += f"\n\t- Median Shot Length: {self.median_shot_length}"

        repr_str += f"\n\t- Max Shot Depth: {self.max_depth}"
        repr_str += f"\n\t- Min Shot Depth: {self.min_depth}"
        repr_str += f"\n\t- Avg Shot Depth: {self.avg_depth}"
        repr_str += f"\n\t- Median Shot Depth: {self.median_depth}"
        return repr_str

    def add_shot(self, shot):
        self._shots.append(weakref.proxy(shot))

    @property
    def name(self):
        return self._name

    @property
    def shots(self):
        return self._shots

    @property
    def total_shots(self):
        return len(self)

    @cached_property
    def _lengths(self):
        return [s.length for s in self.shots]

    @rounded_property(0)
    def length(self):
        return sum(self._lengths)

    @rounded_property(1)
    def avg_shot_length(self):
        return statistics.mean(self._lengths)

    @rounded_property(1)
    def median_shot_length(self):
        return statistics.median(self._lengths)

    @rounded_property(1)
    def max_shot_length(self):
        return max(self._lengths)

    @rounded_property(1)
    def min_shot_length(self):
        return min(self._lengths)

    @cached_property
    def _depths(self):
        return [s.depth for s in self.shots]

    @rounded_property(1)
    def avg_depth(self):
        return statistics.mean(self._depths)

    @rounded_property(1)
    def median_depth(self):
        return statistics.median(self._depths)

    @rounded_property(1)
    def max_depth(self):
        return max(self._depths)

    @rounded_property(1)
    def min_depth(self):
        return min(self._depths)
