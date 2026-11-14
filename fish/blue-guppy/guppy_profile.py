"""Side profile and fin outlines in reference-image pixels."""

from bisect import bisect_right


PIXELS_PER_UNIT = 440
ORIGIN_X = 1035
ORIGIN_Y = 560

# Side-profile sections from the refined reference. Width is the half-width
# across the body inferred from the shoulder, belly and narrow tail root.
BODY = (
    (603, 513, 572, 14), (625, 497, 589, 22), (658, 487, 604, 30),
    (706, 485, 609, 36), (762, 479, 614, 42), (823, 470, 622, 47),
    (883, 464, 641, 52), (942, 457, 663, 56), (998, 456, 677, 60),
    (1052, 464, 681, 61), (1105, 474, 679, 59), (1165, 486, 671, 55),
    (1222, 499, 654, 50), (1274, 510, 640, 44), (1310, 521, 625, 37),
    (1348, 539, 608, 28), (1371, 549, 594, 19), (1386, 559, 584, 10),
    (1390, 568, 575, 3), (1391, 571, 572, 0),
)

TAIL_EDGE = (
    (652, 482), (629, 430), (610, 353), (578, 287), (551, 239),
    (508, 187), (459, 134), (411, 98), (366, 72), (323, 48), (279, 27),
    (257, 24), (235, 36), (212, 57), (183, 96), (157, 134), (132, 182),
    (108, 245), (90, 292), (77, 370), (66, 414), (61, 462), (55, 524),
    (60, 586), (65, 647), (73, 705), (87, 765), (102, 819), (121, 871),
    (140, 927), (158, 964), (176, 1017), (193, 1045), (226, 1061),
    (260, 1060), (312, 1043), (369, 1021), (424, 992), (467, 967),
    (505, 931), (551, 871), (579, 831), (608, 773), (633, 722),
    (653, 674), (668, 628), (681, 598),
)
TAIL_ROOT = (629, 547)
DORSAL_EDGE = (
    (621, 544), (641, 507), (645, 484), (634, 435), (628, 388), (624, 344), (611, 313), (601, 293),
    (637, 298), (671, 310), (706, 323), (751, 325), (787, 304), (826, 291),
    (870, 292), (908, 311), (937, 334), (960, 368), (975, 405), (988, 456), (1018, 510),
)
DORSAL_ROOT = (840, 528)
ANAL_EDGE = (
    (1008, 663), (985, 673), (950, 671), (910, 665), (871, 663),
    (831, 665), (804, 659), (781, 650), (780, 644), (799, 634), (829, 623),
    (872, 610), (907, 612),
)
ANAL_ROOT = (955, 638)
VENTRAL_EDGE = (
    (876, 738), (903, 712), (953, 693), (981, 674), (1009, 667),
    (1031, 675), (1006, 699), (965, 721), (918, 736), (880, 743),
)
VENTRAL_ROOT = (1005, 659)

# Source-space bounds include padding outside the visible fin.
FIN_CROPS = {
    "tail": (37, 9, 697, 1080),
    "dorsal": (586, 273, 1040, 555),
    "anal": (760, 603, 1040, 688),
    "ventral": (859, 640, 1046, 761),
}

EYE_X, EYE_Y, EYE_RADIUS = 1308, 569, 34


def sample_profile(rows, x):
    """Shape-preserving cubic interpolation for the traced profile."""
    keys = [row[0] for row in rows]
    i = max(0, min(len(rows) - 2, bisect_right(keys, x) - 1))
    span = keys[i + 1] - keys[i]
    t = max(0, min(1, (x - keys[i]) / span))

    def slope(index, axis):
        if index == 0:
            return (rows[1][axis] - rows[0][axis]) / (keys[1] - keys[0])
        if index == len(rows) - 1:
            return (rows[-1][axis] - rows[-2][axis]) / (keys[-1] - keys[-2])
        left = (rows[index][axis] - rows[index - 1][axis]) / (keys[index] - keys[index - 1])
        right = (rows[index + 1][axis] - rows[index][axis]) / (keys[index + 1] - keys[index])
        return 0 if left * right <= 0 else 2 * left * right / (left + right)

    return tuple(
        (2 * t**3 - 3 * t**2 + 1) * rows[i][axis]
        + (t**3 - 2 * t**2 + t) * span * slope(i, axis)
        + (-2 * t**3 + 3 * t**2) * rows[i + 1][axis]
        + (t**3 - t**2) * span * slope(i + 1, axis)
        for axis in range(1, len(rows[0]))
    )
