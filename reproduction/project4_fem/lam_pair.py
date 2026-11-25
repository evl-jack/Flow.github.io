"""Check the Re=50 laminar density adjoint for an opening of both branch shoulders."""
import json
import sys
from pathlib import Path

import numpy as np
from scipy.special import expit

from .project43_baseline import Geometry
from .project43_brinkman import create_problem
from .project43_power import port_power


def run(wall_report):
    candidate = wall_report["best_feasible"]
    width = candidate["shoulder_width_mm"]
    throat = candidate["open_height_mm"]
    g = Geometry()
    spacing = .25
    fem, base, fixed, values, ports, flux, _ = create_problem(g, spacing)
    x, y = fem.quad_points.transpose(2, 0, 1) * g.height_mm
    shoulders = (y > 4) & (y < 6)
    baffle = (x > 13) & (x < 14)
    mu, rho, height, re = .001002, 998.2, .004, 50.
    speed = re*mu/(rho*height)
    power_scale = mu*speed**2
    alpha = 1.e6*height**2/mu
    transition = spacing/2
    load = fem.load()

    def resistance(shoulder, throat):
        fraction = expit((.5+shoulder-abs(x-10))/transition)
        gamma = np.where(shoulders, fraction, base)
        gamma = np.where(baffle & (y < 4), expit((throat-y)/transition), gamma)
        derivative = np.where(shoulders, fraction*(1-fraction)/transition, 0.)
        dh = np.where(baffle & (y < 4), gamma*(1-gamma)/transition, 0.)
        return alpha*(1-gamma)**2, -2*alpha*(1-gamma[:,:,None])*np.stack([dh,derivative],axis=-1)

    def responses(state):
        inlet, main, side = flux @ state.values
        if min(inlet, main, side) <= 0 or abs(main+side-inlet)/inlet > 1.e-9:
            raise ValueError("Outlet flux check failed")
        power, grad = port_power(fem, ports, state.values, re)
        share = side/inlet
        return (np.array([sum(power)*power_scale, share]),
                np.stack([grad*power_scale, (flux[2]-share*flux[0])/inlet]))

    from scipy.optimize import minimize
    from .project43_explicit import axis, solve
    cache={}
    def evaluate(v):
        key=tuple(v)
        if key not in cache:
            drag,d=resistance(v[1],v[0]); state=None
            for inertia in (0.,25.,50.):
                fem.inertia=inertia
                state=fem.solve(fixed,values,load,resistance=drag,initial=state.values if state else None)
            r,g=responses(state); j=fem.drag_adjoint(state,g,d); cache[key]=(r,j)
        return cache[key]
    start=np.array([throat,width]); r0,j0=evaluate(start)
    for step in (.002,.001):
        fd=(evaluate(start+[step,0])[0]-evaluate(start-[step,0])[0])/(2*step)
        np.testing.assert_allclose(fd,j0[:,0],rtol=.001,atol=1e-12)
    def cons(v):
        q=evaluate(v)[0][1];return np.array([100*(q-.499),100*(.501-q),4-v[0]-4*v[1]])
    def cj(v):
        dq=100*evaluate(v)[1][1];return np.vstack([dq,-dq,[-1,-4]])
    opt=minimize(lambda v:evaluate(v)[0][0]/r0[0],start,jac=lambda v:evaluate(v)[1][0]/r0[0],method='SLSQP',bounds=[(.15,4),(0,1)],constraints=[dict(type='ineq',fun=cons,jac=cj)],options=dict(ftol=1e-10,maxiter=35)); h,s=opt.x
    xa=axis([0,9.5-s,9.5,10.5,10.5+s,13,14,20],.25);ya=axis([0,h/4,h/2,.75*h,h,4,6,7],.25);wall=solve(xa,ya,h,s)
    return dict(success=bool(opt.success),message=opt.message,start=r0.tolist(),h=h,s=s,density=evaluate(opt.x)[0].tolist(),constraints=cons(opt.x).tolist(),wall=wall,iterations=opt.nit)
if __name__=='__main__':
    r=run(json.loads(Path(sys.argv[1]).read_text())); Path('pair.json').write_text(json.dumps(r,indent=2));print(r);sys.exit(0 if r['success'] else 2)
