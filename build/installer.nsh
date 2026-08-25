!macro customInstall
  ; Clean only shortcuts left by the old Knock brand.
  ; DO NOT delete Rodnik shortcuts here: customInstall runs during installation,
  ; so deleting Rodnik.lnk can remove the shortcut that electron-builder just created.
  Delete "$DESKTOP\Knock.lnk"
  Delete "$SMPROGRAMS\Knock.lnk"
  Delete "$APPDATA\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar\Knock.lnk"
!macroend
