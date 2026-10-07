; DeadKernel's installer script (electron-builder.deadkernel.cjs nsis.include). It exists so
; electron-builder never falls back to build/installer.nsh, Vesktop's, which pins the install to
; %LocalAppData%\vesktop: an Accord install there overwrote a real Vesktop's files (2026-10-07).
; Accord goes in its own folder, per user.
!macro preInit
  SetRegView 64
  WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "$LocalAppData\Programs\${PRODUCT_FILENAME}"
  SetRegView 32
  WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "$LocalAppData\Programs\${PRODUCT_FILENAME}"
!macroend
