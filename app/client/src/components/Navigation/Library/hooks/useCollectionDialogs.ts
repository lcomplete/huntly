import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CollectionApi, CollectionVO, CollectionGroupVO } from '../../../../api/collectionApi';

interface ContextMenuState<T> {
  mouseX: number;
  mouseY: number;
  item: T;
}

export function useCollectionDialogs() {
  const queryClient = useQueryClient();

  // Collection states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<CollectionVO | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<number | undefined>();
  const [editingParentId, setEditingParentId] = useState<number | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingCollection, setDeletingCollection] = useState<CollectionVO | null>(null);

  // Group states
  const [groupEditDialogOpen, setGroupEditDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<CollectionGroupVO | null>(null);

  // Context menu states
  const [collectionMenu, setCollectionMenu] = useState<ContextMenuState<CollectionVO> | null>(null);
  const [groupMenu, setGroupMenu] = useState<ContextMenuState<CollectionGroupVO> | null>(null);

  const invalidateTree = useCallback(() => {
    queryClient.invalidateQueries(['collections-tree']);
  }, [queryClient]);

  // Collection handlers
  const openAddCollection = useCallback((groupId: number, parentId?: number) => {
    setEditingCollection(null);
    setEditingGroupId(groupId);
    setEditingParentId(parentId);
    setEditDialogOpen(true);
  }, []);

  const closeCollectionMenu = useCallback(() => setCollectionMenu(null), []);

  const openCollectionMenu = useCallback((e: React.MouseEvent, collection: CollectionVO) => {
    e.preventDefault();
    setCollectionMenu({ mouseX: e.clientX, mouseY: e.clientY, item: collection });
  }, []);

  const openEditCollection = useCallback((collection: CollectionVO) => {
    setEditingCollection(collection);
    setEditingGroupId(collection.groupId);
    setEditingParentId(collection.parentId || undefined);
    setEditDialogOpen(true);
    closeCollectionMenu();
  }, [closeCollectionMenu]);

  const openDeleteCollection = useCallback((collection: CollectionVO) => {
    setDeletingCollection(collection);
    setDeleteDialogOpen(true);
    closeCollectionMenu();
  }, [closeCollectionMenu]);

  const openAddSubCollection = useCallback((collection: CollectionVO) => {
    openAddCollection(collection.groupId, collection.id);
    closeCollectionMenu();
  }, [openAddCollection, closeCollectionMenu]);

  const closeEditDialog = useCallback(() => {
    setEditDialogOpen(false);
    setEditingCollection(null);
    setEditingGroupId(undefined);
    setEditingParentId(undefined);
  }, []);

  const saveCollection = useCallback(async (name: string, icon?: string, color?: string) => {
    try {
      if (editingCollection) {
        await CollectionApi.updateCollection(editingCollection.id, { name, icon, color });
      } else if (editingGroupId) {
        await CollectionApi.createCollection({
          groupId: editingGroupId,
          parentId: editingParentId || null,
          name, icon, color,
        });
      }
      invalidateTree();
    } catch (error) {
      console.error('Failed to save collection:', error);
    }
    closeEditDialog();
  }, [editingCollection, editingGroupId, editingParentId, invalidateTree, closeEditDialog]);

  const closeDeleteDialog = useCallback(() => {
    setDeleteDialogOpen(false);
    setDeletingCollection(null);
  }, []);

  const confirmDelete = useCallback(async (deletePages: boolean) => {
    if (deletingCollection) {
      try {
        await CollectionApi.deleteCollection(deletingCollection.id, deletePages);
        invalidateTree();
      } catch (error) {
        console.error('Failed to delete collection:', error);
      }
    }
    closeDeleteDialog();
  }, [deletingCollection, invalidateTree, closeDeleteDialog]);

  // Group handlers
  const openAddGroup = useCallback(() => {
    setEditingGroup(null);
    setGroupEditDialogOpen(true);
  }, []);

  const closeGroupMenu = useCallback(() => setGroupMenu(null), []);

  const openGroupMenu = useCallback((e: React.MouseEvent, group: CollectionGroupVO) => {
    e.preventDefault();
    setGroupMenu({ mouseX: e.clientX, mouseY: e.clientY, item: group });
  }, []);

  const openEditGroup = useCallback((group: CollectionGroupVO) => {
    setEditingGroup(group);
    setGroupEditDialogOpen(true);
    closeGroupMenu();
  }, [closeGroupMenu]);

  const deleteGroup = useCallback(async (group: CollectionGroupVO) => {
    try {
      await CollectionApi.deleteGroup(group.id);
      invalidateTree();
    } catch (error) {
      console.error('Failed to delete group:', error);
    }
    closeGroupMenu();
  }, [invalidateTree, closeGroupMenu]);

  const addCollectionFromGroup = useCallback((group: CollectionGroupVO) => {
    openAddCollection(group.id);
    closeGroupMenu();
  }, [openAddCollection, closeGroupMenu]);

  const closeGroupEditDialog = useCallback(() => {
    setGroupEditDialogOpen(false);
    setEditingGroup(null);
  }, []);

  const saveGroup = useCallback(async (name: string) => {
    try {
      if (editingGroup) {
        await CollectionApi.updateGroup(editingGroup.id, { name });
      } else {
        await CollectionApi.createGroup({ name });
      }
      invalidateTree();
    } catch (error) {
      console.error('Failed to save group:', error);
    }
    closeGroupEditDialog();
  }, [editingGroup, invalidateTree, closeGroupEditDialog]);

  return {
    // Collection dialog states
    editDialogOpen,
    editingCollection,
    editingGroupId,
    editingParentId,
    deleteDialogOpen,
    deletingCollection,
    collectionContextMenu: collectionMenu ? {
      mouseX: collectionMenu.mouseX,
      mouseY: collectionMenu.mouseY,
      collection: collectionMenu.item,
    } : null,

    // Collection handlers
    openAddCollection,
    openCollectionMenu,
    closeCollectionMenu,
    openEditCollection,
    openDeleteCollection,
    openAddSubCollection,
    closeEditDialog,
    saveCollection,
    closeDeleteDialog,
    confirmDelete,

    // Group dialog states
    groupEditDialogOpen,
    editingGroup,
    groupContextMenu: groupMenu ? {
      mouseX: groupMenu.mouseX,
      mouseY: groupMenu.mouseY,
      group: groupMenu.item,
    } : null,

    // Group handlers
    openAddGroup,
    openGroupMenu,
    closeGroupMenu,
    openEditGroup,
    deleteGroup,
    addCollectionFromGroup,
    closeGroupEditDialog,
    saveGroup,
  };
}

