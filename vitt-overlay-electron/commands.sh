##unset the permissions in mac
tccutil reset Microphone
tccutil reset Accessibility


ls -la /Applications | grep -i vitt


cp -R /Volumes/Overlay-Vitt/Overlay-Vitt.app /Applications/

##for local testing fix
xattr -cr YourApp.app

codesign --force --deep --sign - YourApp.app

## verify the code sign 
codesign -dv --verbose=4 YourApp.app