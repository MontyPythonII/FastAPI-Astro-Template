/// <reference types="astro/client" />

import type { User } from './lib/backend';

declare global
{
    namespace App
    {
        interface Locals
        {
            // Populated by src/middleware.ts on every request.
            user : User | null;
        }
    }
}

export {};
