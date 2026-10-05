!macro customInstall
  DetailPrint "Registering Arkive Windows Explorer Context Menu..."
  WriteRegStr HKCU "Software\Classes\*\shell\Arkive" "" "Add to archive with Arkive..."
  WriteRegStr HKCU "Software\Classes\*\shell\Arkive" "Icon" '"$appExe",0'
  WriteRegStr HKCU "Software\Classes\*\shell\Arkive\command" "" '"$appExe" --create "%1"'

  WriteRegStr HKCU "Software\Classes\Directory\shell\Arkive" "" "Add to archive with Arkive..."
  WriteRegStr HKCU "Software\Classes\Directory\shell\Arkive" "Icon" '"$appExe",0'
  WriteRegStr HKCU "Software\Classes\Directory\shell\Arkive\command" "" '"$appExe" --create "%1"'

  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\Arkive" "" "Open Arkive here"
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\Arkive" "Icon" '"$appExe",0'
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\Arkive\command" "" '"$appExe" "%V"'

  ; Archive Associations
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.zip\shell\Arkive.Open" "" "Open with Arkive"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.zip\shell\Arkive.Open" "Icon" '"$appExe",0'
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.zip\shell\Arkive.Open\command" "" '"$appExe" "%1"'
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.zip\shell\Arkive.Extract" "" "Extract files with Arkive..."
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.zip\shell\Arkive.Extract" "Icon" '"$appExe",0'
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.zip\shell\Arkive.Extract\command" "" '"$appExe" --extract "%1"'

  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.7z\shell\Arkive.Open" "" "Open with Arkive"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.7z\shell\Arkive.Open" "Icon" '"$appExe",0'
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.7z\shell\Arkive.Open\command" "" '"$appExe" "%1"'
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.7z\shell\Arkive.Extract" "" "Extract files with Arkive..."
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.7z\shell\Arkive.Extract" "Icon" '"$appExe",0'
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.7z\shell\Arkive.Extract\command" "" '"$appExe" --extract "%1"'

  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.rar\shell\Arkive.Open" "" "Open with Arkive"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.rar\shell\Arkive.Open" "Icon" '"$appExe",0'
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.rar\shell\Arkive.Open\command" "" '"$appExe" "%1"'
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.rar\shell\Arkive.Extract" "" "Extract files with Arkive..."
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.rar\shell\Arkive.Extract" "Icon" '"$appExe",0'
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.rar\shell\Arkive.Extract\command" "" '"$appExe" --extract "%1"'

  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.tar\shell\Arkive.Open" "" "Open with Arkive"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.tar\shell\Arkive.Open" "Icon" '"$appExe",0'
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.tar\shell\Arkive.Open\command" "" '"$appExe" "%1"'

  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.gz\shell\Arkive.Open" "" "Open with Arkive"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.gz\shell\Arkive.Open" "Icon" '"$appExe",0'
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.gz\shell\Arkive.Open\command" "" '"$appExe" "%1"'
!macroend

!macro customUnInstall
  DeleteRegKey HKCU "Software\Classes\*\shell\Arkive"
  DeleteRegKey HKCU "Software\Classes\Directory\shell\Arkive"
  DeleteRegKey HKCU "Software\Classes\Directory\Background\shell\Arkive"
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.zip\shell\Arkive.Open"
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.zip\shell\Arkive.Extract"
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.7z\shell\Arkive.Open"
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.7z\shell\Arkive.Extract"
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.rar\shell\Arkive.Open"
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.rar\shell\Arkive.Extract"
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.tar\shell\Arkive.Open"
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.gz\shell\Arkive.Open"
!macroend
