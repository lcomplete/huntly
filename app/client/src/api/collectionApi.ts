// Collection API types and functions
// These are manually created since we're not regenerating the full OpenAPI client

import axios from 'axios';

// Types
export interface CollectionVO {
    id: number;
    groupId: number;
    parentId?: number | null;
    name: string;
    icon?: string | null;
    color?: string | null;
    displaySequence: number;
    pageCount: number;
    children: CollectionVO[];
}

export interface CollectionGroupVO {
    id: number;
    name: string;
    icon?: string | null;
    color?: string | null;
    displaySequence: number;
    collections: CollectionVO[];
}

export interface CollectionTreeVO {
    unsortedCount: number;
    groups: CollectionGroupVO[];
}

export interface CreateCollectionRequest {
    groupId: number;
    parentId?: number | null;
    name: string;
    icon?: string | null;
    color?: string | null;
}

export interface UpdateCollectionRequest {
    name?: string;
    icon?: string | null;
    color?: string | null;
    parentId?: number | null;
    groupId?: number;
}

export interface CreateGroupRequest {
    name: string;
    icon?: string | null;
    color?: string | null;
}

export interface UpdateGroupRequest {
    name?: string;
    icon?: string | null;
    color?: string | null;
}

export interface CollectionGroup {
    id: number;
    name: string;
    icon?: string | null;
    color?: string | null;
    displaySequence: number;
}

export interface Collection {
    id: number;
    groupId: number;
    parentId?: number | null;
    name: string;
    icon?: string | null;
    color?: string | null;
    displaySequence: number;
}

// API functions
const BASE_URL = '/api';

export const CollectionApi = {
    // Tree
    getTree: async (): Promise<CollectionTreeVO> => {
        const response = await axios.get<CollectionTreeVO>(`${BASE_URL}/collections/tree`);
        return response.data;
    },

    // Collections
    createCollection: async (data: CreateCollectionRequest): Promise<Collection> => {
        const response = await axios.post<Collection>(`${BASE_URL}/collections`, data);
        return response.data;
    },

    updateCollection: async (id: number, data: UpdateCollectionRequest): Promise<Collection> => {
        const response = await axios.put<Collection>(`${BASE_URL}/collections/${id}`, data);
        return response.data;
    },

    deleteCollection: async (id: number, deletePages: boolean = false): Promise<void> => {
        await axios.delete(`${BASE_URL}/collections/${id}`, { data: { deletePages } });
    },

    getCollection: async (id: number): Promise<Collection> => {
        const response = await axios.get<Collection>(`${BASE_URL}/collections/${id}`);
        return response.data;
    },

    getPageCount: async (id: number): Promise<number> => {
        const response = await axios.get<{ count: number }>(`${BASE_URL}/collections/${id}/page-count`);
        return response.data.count;
    },

    reorderCollections: async (ids: number[], newParentId?: number | null, newGroupId?: number | null): Promise<void> => {
        await axios.post(`${BASE_URL}/collections/reorder`, { ids, newParentId, newGroupId });
    },

    // Groups
    getAllGroups: async (): Promise<CollectionGroup[]> => {
        const response = await axios.get<CollectionGroup[]>(`${BASE_URL}/collection-groups`);
        return response.data;
    },

    createGroup: async (data: CreateGroupRequest): Promise<CollectionGroup> => {
        const response = await axios.post<CollectionGroup>(`${BASE_URL}/collection-groups`, data);
        return response.data;
    },

    updateGroup: async (id: number, data: UpdateGroupRequest): Promise<CollectionGroup> => {
        const response = await axios.put<CollectionGroup>(`${BASE_URL}/collection-groups/${id}`, data);
        return response.data;
    },

    deleteGroup: async (id: number): Promise<void> => {
        await axios.delete(`${BASE_URL}/collection-groups/${id}`);
    },

    reorderGroups: async (ids: number[]): Promise<void> => {
        await axios.post(`${BASE_URL}/collection-groups/reorder`, { ids });
    },

    // Page collection assignment
    updatePageCollection: async (pageId: number, collectionId: number | null): Promise<void> => {
        await axios.patch(`${BASE_URL}/page/${pageId}/collection`, { collectionId });
    },
};

export default CollectionApi;
