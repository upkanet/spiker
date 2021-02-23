# Spiker by Axorus
Multi Electrodes Array (MEA) records analyzer

## Install
Install NodeJS & Git, then
In Powershell (or any bash)
(change my_app_folder by any place you want)
```bash
cd my_apps_folder
git clone https://github.com/upkanet/spiker.git
cd spiker
npm i
cp config-template.json config.json
```
*in plain english*
```
move into "my_apps_folder" (cd = change directory)
copy git code to current folder
move into "spiker" folder
install all libraries using npm (node package manager)
copy config-template.json to config.json, to use your own parameters without being erased after an update
```

## Prepare
Convert .mcd file into .raw files with MC_DataTool :
1. Open multiple mcd files you want to convert
2. Click on *bin* button
3. In *Electrode Raw Data* click on *All*
4. Check *Write header* and *Signed 16bit*
5. Choose path in with *Browse* button
6. Click on *Save*, you will end up with .raw files about the same size of the original .mcd files

## Analyze

```bash
node app.mjs path_to_raw_files_folder list_of_electrodes
```
*for example*
```bash
node app.mjs data 251,9,17
```

Once the server is ready, go to [http://localhost:3000/](http://localhost:3000/)