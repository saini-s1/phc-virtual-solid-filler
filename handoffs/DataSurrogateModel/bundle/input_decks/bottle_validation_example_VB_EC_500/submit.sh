#!/bin/bash
#BSUB -J VB_EC_500
#BSUB -n 16
#BSUB -g /fd2997/cyl_doe
#BSUB -q standard
#BSUB -G health
#BSUB -P 2026
#BSUB -W 8:00
#BSUB -cwd "/home/health/fd2997/cylinder_doe/runs_bottle/VB_EC_500"
#BSUB -R "select[defined(aspherix_solver)] rusage[aspherix_solver=16:duration=5]"
#BSUB -app aspherix
#BSUB -o /home/health/fd2997/cylinder_doe/runs_bottle/VB_EC_500/lsf_%J.o
#BSUB -e /home/health/fd2997/cylinder_doe/runs_bottle/VB_EC_500/lsf_%J.e

cd "/home/health/fd2997/cylinder_doe/runs_bottle/VB_EC_500" || exit 1
source /etc/profile.d/modules.sh
module load aspherix
mkdir -p post
mpirun -np 16 aspherix -in packing.asx
