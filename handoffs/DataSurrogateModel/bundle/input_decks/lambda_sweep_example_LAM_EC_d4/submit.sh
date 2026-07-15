#!/bin/bash
#BSUB -J LAM_EC_d4
#BSUB -n 16
#BSUB -g /fd2997/cyl_doe
#BSUB -q standard
#BSUB -G health
#BSUB -P 2026
#BSUB -W 4:00
#BSUB -cwd "/home/health/fd2997/cylinder_doe/runs_lambda/LAM_EC_d4"
#BSUB -R "select[defined(aspherix_solver)] rusage[aspherix_solver=16:duration=5]"
#BSUB -app aspherix
#BSUB -o /home/health/fd2997/cylinder_doe/runs_lambda/LAM_EC_d4/lsf_%J.o
#BSUB -e /home/health/fd2997/cylinder_doe/runs_lambda/LAM_EC_d4/lsf_%J.e

# Data isolation: every job runs entirely inside its OWN folder so the
# fixed-name outputs (post/particles*.vtk, log_aspherix.txt,
# simulation_data_aspherix.csv) can never collide between concurrent runs.
cd "/home/health/fd2997/cylinder_doe/runs_lambda/LAM_EC_d4" || exit 1
source /etc/profile.d/modules.sh
module load aspherix
mkdir -p post
mpirun -np 16 aspherix -in packing.asx
