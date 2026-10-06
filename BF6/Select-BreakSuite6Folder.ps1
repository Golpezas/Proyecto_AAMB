Add-Type -AssemblyName System.Windows.Forms

$picker = New-Object System.Windows.Forms.FolderBrowserDialog
$picker.Description = 'Select the BreakSuite6 folder that contains BreakSuite6.exe'

if ($picker.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
  Write-Output $picker.SelectedPath
}
