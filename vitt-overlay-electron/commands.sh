##unset the permissions in mac
tccutil reset Microphone
tccutil reset Accessibility


ls -la /Applications | grep -i vitt


cp -R /Volumes/Overlay-Vitt/Overlay-Vitt.app /Applications/

## Check for a Broken Executable -rw-r--r-- (lost execute permission) , -rwxr-xr-x (has execute permission)
ls -la /Applications/Overlay-Vitt.app/Contents/MacOS/ 
chmod +x /Applications/Overlay-Vitt.app/Contents/MacOS/*

## if executables permission present 
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f /Applications/Overlay-Vitt.app
## restart finder
killall Finder


## unhide the app 
chflags nohidden /Applications/Overlay-Vitt.app

## touch the app to force a rebuild
touch /Applications/Overlay-Vitt.app
killall Finder


##
npx electron-builder --mac --arm64
npx electron-builder --mac --universal

##for local testing fix
xattr -cr YourApp.app

codesign --force --deep --sign - YourApp.app

## verify the code sign 
codesign -dv --verbose=4 YourApp.app