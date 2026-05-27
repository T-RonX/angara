declare global {
    interface ImportMeta {
        env: {
            BASE_URL: string;
            [key: string]: any;
        };
    }
}

export {};
