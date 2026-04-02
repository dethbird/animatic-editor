import type { StateCreator } from 'zustand';
import type { Project } from '../../types/project';
import { newProject as makeNewProject } from '../../lib/projectDefaults';

export type ProjectSlice = {
  // state
  project: Project | null;
  filePath: string | null;
  dirty: boolean;
  // actions
  newProject: (name: string) => void;
  setProject: (project: Project) => void;
  updateProjectMeta: (patch: Partial<Pick<Project, 'name' | 'updatedAt'>>) => void;
  markDirty: (dirty: boolean) => void;
};

export const createProjectSlice: StateCreator<ProjectSlice, [], [], ProjectSlice> = (set) => ({
  project: null,
  filePath: null,
  dirty: false,

  newProject: (name) => {
    set({
      project: makeNewProject(name),
      filePath: null,
      dirty: false,
    });
  },

  setProject: (project) => {
    set({ project, dirty: false });
  },

  updateProjectMeta: (patch) => {
    set((state) => {
      if (!state.project) return {};
      return {
        project: {
          ...state.project,
          ...patch,
          updatedAt: new Date().toISOString(),
        },
        dirty: true,
      };
    });
  },

  markDirty: (dirty) => set({ dirty }),
});
