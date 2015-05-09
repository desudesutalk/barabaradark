# barabaradark (p2p experiments)
Distributed Tor-hidden encrypted anonymous image board with *imouticons*.

## Installing on Linux
You need two packages to be installed on your system: `tor` and `sqlite3`. Use your package manager to install them.

Clone this repository or [download zip file](https://github.com/desudesutalk/barabaradark/archive/master.zip) and extract somewhere.

Now download appropriate [nw.js package](http://nwjs.io/) and extract it into BaraBaraDark folder (`nw` binary should be in the same folder as `index.html`).

Now just start `nw`.

## Installing on Windows
[Download zip](https://github.com/desudesutalk/barabaradark/archive/master.zip) and extract it.

**WARNING:** Use simple folder names like `C:\barabardark\` or `D:\temp\bbd\`. BBD will not start on windows if path contains unicode characters (accented chars, Russian letters, etc).

[Download Tor](https://www.torproject.org/dist/torbrowser/4.5/tor-win32-0.2.6.7.zip) and extract *.exe and *.dll into BBD folder.

[Download sqlite3 cli tool](https://www.sqlite.org/2015/sqlite-shell-win32-x86-3080900.zip) and extract it into BBD folder.

[Download nw.js package](http://nwjs.io/) - note that there are 32bit and 64bit versions. Choose one what match your system. Extract all files to BBD folder.

Now your BBD folder must look like:
```
assets
data
lib
locales
node_modules
credits.html
d3dcompiler_47.dll
ffmpegsumo.dll
icudtl.dat
index.html
libeay32.dll
libEGL.dll
libevent-2-0-5.dll
libevent_core-2-0-5.dll
libevent_extra-2-0-5.dll
libgcc_s_sjlj-1.dll
libGLESv2.dll
libssp-0.dll
LICENSE
main.js
nw.exe
nw.pak
nwjc.exe
package.json
pdf.dll
README.md
sqlite3.exe
ssleay32.dll
tor.exe
zlib1.dll
```

Now start `nw.exe`
