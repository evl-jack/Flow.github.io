---
layout: default
title: Coolant Manifold Project
---


# Project 4 : Optimal Flow manifold Design
Group : Ai Generated

## Flow Manifold: Coolant distribution manifold for GPU racks

Data centers are what are driving modern day inovation and inorder to keep them working effiently they need to be properly maintained. A cooling system for a general GPU rack starts from a heat exchanger which pumps coolant to a Rack manifold which distributes coolant through multiple channels into each rack. Then each rack has its own flow manifold to distribute coolant directly to a cold plate on a CPU chip. Optimal design of these manifold is important to ensure equal and controlled flow of the coolant to ensure proper cooling of large scale networks.

## Structure

For the purposes of the model I broke it up into two parts: 

**2D model** : This was a small scale experiment ment to verifiy my use of the governing Naviar-Stokes equations, Brinkman Penilization & Density feilds, and Turbulent Simulations. The structure modeled was a 2 Dimensional box manifold with one inlet and 3 outlets. The goal was to minimize pumping power $ P = Q $ under the conditions that all three outlets volumentric flow rates are equal within a tolerance of 3% - 5%. The model optimized internal sturcture of the manifold without changing externala geometry.

**3D model** : I took referance from standard vertical rack manifolds. I wanted to observe the differences between 3 models. Model one had sharp geometry at the junctions creating an enviorment for pressure loss and hydraulic resistance. Model two sofented the edges around the junctions to hopefully reduce turbulant conditions. Model three was a branched model that distributed coolant from one main channel into multiple branches that curved toward there respective junction. This model preserved most of the dynamics from the 2D model, but reworks where required to validate meshing, geometry, and the results.

## Design Critera

## Verifications



## Progress
- Definded Problem
- Finished 2D analysis and verifications
- Optimized 2D model
- Currently working on verifing 2D optimization
- Currently working on 3D scaled analysis












