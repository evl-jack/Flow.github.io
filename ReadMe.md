# Coolant manifold design optimization

[Report and interactive comparison](https://evl-jack.github.io/Flow.github.io/) · [Report source](index.md) · [Course brief](https://designinformaticslab.github.io/DesignOptimization2025/project4.html)

## Source and reproduction

The underlying [Coolant Manifold solver repository](https://github.com/evl-jack/Coolant_Manifold) records the broader solver development. The `reproduction/` package here includes the historical laminar FEM and optimization source from job 2350992 and the postprocessing code for this report.

| Sol job | Evidence |
|---|---|
| 2082615 | Exact-solution, assembly, manufactured and tangent verification |
| 2350992 | Smooth-density Re 50 optimization and its archived endpoint |
| 2351149, 2351257, 2351770 | Fitted reconstruction, geometry correction and fitted mesh checks |
| 2351347 | Independent OpenFOAM cell pressure and speed used in the viewer |
| 2351608 | Gross and net binary Brinkman interface crossings |
| 2377911 | Actual smooth-density CFD endpoint adjoint and KKT audit |
| 2377694, 2377706, 2377774, 2377794 | SST prescribed-state verification |

The data exporter reads original Sol archives from the project evidence directory. It requires Python 3 and NumPy. It never launches a flow solver.

```bash
python -m pip install -r requirements.txt
python reproduction/export_results.py /path/to/Project43_ChatGPT assets/results.json
```

The inputs are `Project43-Sol-results.tar.gz` and `Project43-final-evidence.tar.gz`. If you have the project archives, the command regenerates the published comparison data. The JSON labels each field and metrics source. The archived viewer colors use cell-centered OpenFOAM values. The displayed pass/fail metrics use the finer fitted FEM cases.

For the documented sensitivity check, see the [laminar KKT audit](https://chatgpt.com/library?file_id=libfile_b7ea413319848191890b1039435a9d3c&account_id=personal). The [fine mesh assessment](https://chatgpt.com/library?file_id=libfile_7f3b576775c081919e9ca88a81d2eadc&account_id=personal) and [SST verification record](https://chatgpt.com/library?file_id=libfile_e5e0aeb5a25c819186764ebe604df1bb&account_id=personal) contain the remaining checksums and run details. Access to those project records may require the original project account.

The site is built by GitHub Pages from Markdown. Open the published site to use the viewer and render equations.
