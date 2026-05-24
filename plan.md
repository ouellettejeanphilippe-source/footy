1. Modify `js/config.js` to add trailing slashes to the base URLs `MLBBITE_PLUS_URL` and `SITE` so standard URL path resolution works correctly.

```javascript
<<<<<<< SEARCH
export var MLBBITE_PLUS_URL = 'https://mlbbite.plus';
=======
export var MLBBITE_PLUS_URL = 'https://mlbbite.plus/';
>>>>>>> REPLACE

<<<<<<< SEARCH
export var SITE = 'https://live1.footybite.to'; // Updated to new live1.footybite.to domain
=======
export var SITE = 'https://live1.footybite.to/'; // Updated to new live1.footybite.to domain
>>>>>>> REPLACE
```

2. Run `npm test` to ensure tests still pass.

3. Complete pre commit step.

4. Submit the change.
