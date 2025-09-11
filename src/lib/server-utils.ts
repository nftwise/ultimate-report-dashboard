import fs from 'fs';
import path from 'path';

export async function getClientConfig(clientId: string): Promise<any | null> {
  try {
    const filePath = path.join(process.cwd(), 'src', 'data', 'clients.json');
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const clientsData = JSON.parse(fileContents);
    
    const client = clientsData.clients.find((client: any) => client.id === clientId);
    return client || null;
  } catch (error) {
    console.error('Error reading client config:', error);
    return null;
  }
}