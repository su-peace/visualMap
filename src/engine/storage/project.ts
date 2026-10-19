import { ProjectData } from '../../types';

/**
 * C-DATA-01: Tactical Project Serializer & Validator
 * Saves and loads `.tacmap.json` project files.
 */
export class ProjectSerializer {
  public static serialize(project: ProjectData): string {
    return JSON.stringify(project, null, 2);
  }

  public static deserialize(jsonString: string): ProjectData {
    const data = JSON.parse(jsonString) as ProjectData;
    if (!data.version || !data.terrainConfig) {
      throw new Error('Invalid tactical map project schema');
    }
    return data;
  }

  /**
   * Triggers browser download of project JSON
   */
  public static exportToFile(project: ProjectData, filename?: string): void {
    const jsonStr = this.serialize(project);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `${project.operationCode || 'OPERATION'}_${Date.now()}.tacmap.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Prompts user to select a `.tacmap.json` file from disk
   */
  public static async importFromFile(): Promise<ProjectData> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,.tacmap.json';

      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) {
          reject(new Error('No file chosen'));
          return;
        }

        try {
          const text = await file.text();
          const project = this.deserialize(text);
          resolve(project);
        } catch (err) {
          reject(err);
        }
      };

      input.click();
    });
  }
}
