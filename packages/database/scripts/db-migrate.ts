import * as readline from 'readline';
import { spawn } from 'child_process';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const askName = () => {
  rl.question('Enter a name for the new migration: ', (name) => {
    if (!name.trim()) {
      console.log('Migration name cannot be empty. Please try again.');
      askName();
    } else {
      rl.close();

      const formattedName = name.trim().replace(/\s+/g, '_');
      const command = `prisma migrate dev --name ${formattedName}`;

      const child = spawn(command, {
        stdio: 'inherit',
        shell: true,
      });

      child.on('exit', (code) => {
        process.exit(code ?? 0);
      });
    }
  });
};

askName();
