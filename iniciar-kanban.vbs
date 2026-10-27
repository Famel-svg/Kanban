Set shell = CreateObject("WScript.Shell")
Set files = CreateObject("Scripting.FileSystemObject")
launcher = files.BuildPath(files.GetParentFolderName(WScript.ScriptFullName), "iniciar-kanban.bat")
shell.Run "cmd.exe /c """ & launcher & """ --startup", 0, False
