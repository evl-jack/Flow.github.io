"""Build published data from the three archived Project 4.3 result packages."""
import argparse
import json
import re
import tarfile
from pathlib import Path

import numpy as np


def record(archive, name):
    return json.loads(archive.extractfile(name).read())


def axis(breaks, step):
    intervals = [np.linspace(a, b, int(np.ceil((b-a)/step-1e-12))+1)[:-1]
                 for a, b in zip(breaks, breaks[1:]) if b > a]
    return np.concatenate([*intervals, [breaks[-1]]])


def field(archive, name, components, count):
    data = archive.extractfile(name).read().decode()
    match = re.search(r"internalField\s+nonuniform\s+List<\w+>\s+\d+\s*\(\s*(.*?)\s*\)\s*;", data, re.S)
    if not match:
        raise ValueError(f"Expected a nonuniform archived field: {name}")
    values = np.fromstring(match[1].replace("(", " ").replace(")", " "), sep=" ")
    return values.reshape(count, components)


def build(root, output):
    models = []
    with tarfile.open(root / "Project43-Sol-results.tar.gz") as openfoam, \
            tarfile.open(root / "Project43-final-evidence.tar.gz") as fem:
        for case, fine, label in (("balanced", "balanced", "Balanced reference"),
                                  ("candidate", "revised", "Revised design")):
            stem = "foam-lam-01/foam-2351347-" + case
            meta = record(openfoam, stem + "/manifest.json")
            run = record(openfoam, stem + "/report.json")
            h, s, spacing = (meta[name] for name in ("throat_mm", "shoulder_mm", "spacing_mm"))
            x = axis([0, 9.5-s, 9.5, 10.5, 10.5+s, 13, 14, 20], spacing)
            y = axis([0, h/4, h/2, .75*h, h, 4, 6, 7], spacing)
            xx, yy = np.meshgrid((x[:-1]+x[1:])/2, (y[:-1]+y[1:])/2)
            fluid = ((yy < 4) & ~((xx > 13) & (xx < 14) & (yy > h))) | (
                     (yy > 4) & (abs(xx-10) < .5+s*(yy < 6)))
            j, i = np.nonzero(fluid)
            prefix = f"{stem}/{run['iteration']}"
            pressure = meta["density"]*field(openfoam, prefix+"/p", 1, meta["cells"])[:, 0]
            speed = np.linalg.norm(field(openfoam, prefix+"/U", 3, meta["cells"]), axis=1)
            assert i.size == pressure.size == speed.size
            verified = record(fem, f"fine-{fine}.json")
            metrics = dict(h=h, s=s, area=verified["area_mm2"], power=1e6*verified["pumping_power_W_per_m"],
                           split=100*verified["side_share"], triangles=verified["triangles"])
            cells = [[int(ix), int(iy), round(float(q), 7), round(float(u), 7)]
                     for ix, iy, q, u in zip(i, j, pressure, speed)]
            models.append(dict(label=label, metrics=metrics, x=x.round(9).tolist(),
                               y=y.round(9).tolist(), cells=cells))
        pair = record(openfoam, "lam-pair-01/pair.json")
        revised = models[1]["metrics"]
        log = openfoam.extractfile("lam-pair-01/slurm-2351257.out").read().decode()
        correction = []
        labels = ("Direct wall reconstruction", "First correction", "Corrected geometry")
        notes = ("The fitted split falls below the band.", "The area-preserving step restores a near-even split.",
                 "The 0.125 mm correction is followed by an independent fine-mesh check.")
        for line in log.splitlines():
            match = re.fullmatch(r"step (\d+) ([\deE+.-]+) ([\deE+.-]+) \[\s*([\deE+.-]+)\s+([\deE+.-]+)\s*\]", line)
            if match:
                n, h, s, split, power = match.groups()
                n = int(n)
                correction.append(dict(label=labels[n], h=float(h), s=float(s), split=100*float(split),
                                       power=1e6*float(power), note=notes[n]))
        assert len(correction) == 3
        correction.append(dict(label="Fine fitted check", **{k: revised[k] for k in ("h","s","split","power")},
                               note="The fine fitted FEM split is in the target band."))
    ranges = {name:[min(c[index] for m in models for c in m["cells"]),
                    max(c[index] for m in models for c in m["cells"])]
              for name,index in (("pressure",2),("speed",3))}
    results = dict(field_source="Sol 2351347, cell-centered OpenFOAM", metrics_source="Sol 2351770, fitted FEM",
                   models=models, ranges=ranges, correction=correction,
                   smooth_optimization=dict(start=pair["start"], end=pair["density"], iterations=pair["iterations"]))
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(results, separators=(",", ":")), encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive_dir", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    build(args.archive_dir, args.output)
