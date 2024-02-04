# neutralinojs-angular

An empty Neutralinojs + Angular app, extend as you wish
> Since neutralino's [using frontend libraries tutorial](https://neutralino.js.org/docs/getting-started/using-frontend-libraries) is broken for angular, 
> I had to use [this post](https://stackoverflow.com/questions/76314240/use-angular-inside-neutralinojs) instead 
> Frontend build for angular is broken since   
## Install neutralino & angular dependencies (globally)
```sh
npm install -g @neutralinojs/neu
npm install -g @angular/cli
```

## Initialize neutralino & angular
_Run this into project root to create & fill `bin/` with Neutralino binaries
```sh
neu update
```


## Install angular dependencies
```sh
cd angular-src
npm i
```

## Run app
```sh
cd angular-src
npm run watch
```
Then
```sh
neu run
```
Refresh the page after each frontend edit

## Known limitations

- Have to refresh the page manually after each change <br>
> Using the classic `npm start` will create a front server but all the transpiled files are in memory only. 
> Thus Neutralino cannot patch the neutralino.js & set its JS's `window` variables 