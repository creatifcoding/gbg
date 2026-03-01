# GetByShell — Mission-Control Scripts (generated from library)
#
# This module delegates to the getbyshell library at nix/lib/getbyshell/.
# All per-surface and global scripts are auto-generated from surface declarations.
#
# Previously: hand-written bar.nix + panel.nix + 100 lines of scripts here.
# Now: one import, zero maintenance.
{ inputs, lib, ... }:

{
  imports = [ ../../lib/getbyshell ];
}
