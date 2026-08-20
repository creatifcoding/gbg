// mantis doctor Gmsh fixture — unit cube
SetFactory("OpenCASCADE");
Box(1) = {0, 0, 0, 1, 1, 1};
MeshSize {:} = 0.5;
Mesh 3;
