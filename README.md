# spiker
Multi Electrodes Array (MEA) records analyzer

Install
```bash
git clone https://github.com/upkanet/spiker.git
npm i

```

Launch the server (Node with Modules >= v14.15.4)
```bash
node app.mjs mearecord.csv meamapping.csv

```
Fourier Transform server

```bash
node ft.mjs data-test/sin.txt

```

Then go to [http://localhost:8080/](http://localhost:8080/)