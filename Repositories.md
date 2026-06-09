# Models
Sources that represent the database tables.

Imported by `Models/modelsInit.js` to initialize the database tables. modelsInit must be in the same directory as the database table modules!

Creating a new module should be done as shown below.
```js
import type { Result } from "pg";

import database from '../Config/database.js';
import type { TableInterface } from "../Interfaces/database_types.js";

export default async function Table(): Promise<Result<TableInterface>> {
    try{
        const result: Result<TableInterface> = await database.query(
            
        );
        
        return result;
    } catch(error) {
        console.error(error);
        throw error;
    }
}
```

- guildmodules: Guilds can unsubscribe from command groups that are guild scoped, this table remembers the excluded commands.
- botconfig: Bot-related configuration for persistence between restarts
