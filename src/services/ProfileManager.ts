import * as vscode from 'vscode';
import { Constants } from '../constants';
import { FilterGroup } from '../models/Filter';

export interface FilterProfile {
    name: string;
    groups: FilterGroup[];
    updatedAt: number;
}

export class ProfileManager {
    private _onDidChangeProfile: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    readonly onDidChangeProfile: vscode.Event<void> = this._onDidChangeProfile.event;

    constructor(private context: vscode.ExtensionContext) { }

    public getActiveProfile(): string {
        return this.context.globalState.get<string>(Constants.GlobalState.ActiveProfile) || Constants.Labels.DefaultProfile;
    }

    public getProfileNames(): string[] {
        const profiles = this.context.globalState.get<FilterProfile[]>(Constants.GlobalState.FilterProfiles) || [];
        const names = profiles.map(p => p.name);
        if (!names.includes(Constants.Labels.DefaultProfile)) {
            names.unshift(Constants.Labels.DefaultProfile);
        }
        return names.sort((a, b) => {
            if (a === Constants.Labels.DefaultProfile) {
                return -1;
            }
            if (b === Constants.Labels.DefaultProfile) {
                return 1;
            }
            return a.localeCompare(b);
        });
    }

    public getProfilesMetadata(): { name: string, wordCount: number, regexCount: number }[] {
        const profiles = this.context.globalState.get<FilterProfile[]>(Constants.GlobalState.FilterProfiles) || [];

        // Check if Default is present
        const hasDefault = profiles.some(p => p.name === Constants.Labels.DefaultProfile);

        const metadata = profiles.map(p => {
            let wordCount = 0, regexCount = 0;
            if (p.groups) {
                p.groups.forEach(g => {
                    // Check group regex? No, original code checked 'g.isRegex' on the group level?
                    // Original: p.groups.filter(g => !g.isRegex).length
                    // Wait, original logic in FilterManager was:
                    // wordCount: p.groups.filter(g => !g.isRegex).length
                    // regexCount: p.groups.filter(g => g.isRegex).length

                    // It counted GROUPS, not filters?
                    // Let's check original code in Step 167 view.
                    // "wordCount: p.groups.filter(g => !g.isRegex).length"
                    // Yes, it counted groups.

                    if (g.isRegex) {
                        regexCount++;
                    } else {
                        wordCount++;
                    }
                });
            }
            return { name: p.name, wordCount, regexCount };
        });

        if (!hasDefault) {
            // Default profile usually has Presets (1 group)
            metadata.unshift({ name: Constants.Labels.DefaultProfile, wordCount: 1, regexCount: 0 });
        }

        return metadata.sort((a, b) => {
            if (a.name === Constants.Labels.DefaultProfile) {
                return -1;
            }
            if (b.name === Constants.Labels.DefaultProfile) {
                return 1;
            }
            return a.name.localeCompare(b.name);
        });
    }

    public async updateProfileData(name: string, groups: FilterGroup[]) {
        if (name === Constants.Labels.DefaultProfile) {
            return; // Default profile uses standard state mechanism, not profile array
        }

        let profiles = this.context.globalState.get<FilterProfile[]>(Constants.GlobalState.FilterProfiles) || [];
        const index = profiles.findIndex(p => p.name === name);
        if (index >= 0) {
            profiles[index].groups = groups;
            profiles[index].updatedAt = Date.now();
        } else {
            profiles.push({ name, groups, updatedAt: Date.now() });
        }
        await this.context.globalState.update(Constants.GlobalState.FilterProfiles, profiles);
    }

    public async deleteProfile(name: string): Promise<boolean> {
        if (name === Constants.Labels.DefaultProfile) {
            return false;
        }

        let profiles = this.context.globalState.get<FilterProfile[]>(Constants.GlobalState.FilterProfiles) || [];
        const initialLen = profiles.length;
        profiles = profiles.filter(p => p.name !== name);

        if (profiles.length !== initialLen) {
            await this.context.globalState.update(Constants.GlobalState.FilterProfiles, profiles);

            // Switch to default if deleted active
            if (this.getActiveProfile() === name) {
                await this.context.globalState.update(Constants.GlobalState.ActiveProfile, Constants.Labels.DefaultProfile);
                this._onDidChangeProfile.fire();
            }
            return true;
        }
        return false;
    }

    public async createProfile(name: string, groupsCopy: FilterGroup[]): Promise<boolean> {
        let profiles = this.context.globalState.get<FilterProfile[]>(Constants.GlobalState.FilterProfiles) || [];
        if (profiles.some(p => p.name === name) || name === Constants.Labels.DefaultProfile) {
            return false;
        }

        const newProfile: FilterProfile = {
            name: name,
            groups: groupsCopy,
            updatedAt: Date.now()
        };
        profiles.push(newProfile);
        await this.context.globalState.update(Constants.GlobalState.FilterProfiles, profiles);
        return true;
    }

    public async loadProfile(name: string): Promise<FilterGroup[] | undefined> {
        if (name === Constants.Labels.DefaultProfile) {
            // Caller should load from default state
            // But we can implicitly switch active profile state here?
            await this.context.globalState.update(Constants.GlobalState.ActiveProfile, Constants.Labels.DefaultProfile);
            this._onDidChangeProfile.fire();
            return undefined; // Signal to load from default storage
        }

        const profiles = this.context.globalState.get<FilterProfile[]>(Constants.GlobalState.FilterProfiles) || [];
        const profile = profiles.find(p => p.name === name);
        if (profile) {
            await this.context.globalState.update(Constants.GlobalState.ActiveProfile, name);
            this._onDidChangeProfile.fire();
            return profile.groups;
        }
        return undefined;
    }
}
