process.env.NODE_ENV = 'test';
// Fichiers envoyés pendant les tests : dossier temporaire, jamais dans le dépôt.
process.env.UPLOAD_DIR = `${(await import('node:os')).tmpdir()}/kodav-test-uploads`;
