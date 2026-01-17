import React, { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageControllerApiFactory } from '../../../api';
import { CollectionApi, CollectionTreeVO, CollectionVO } from '../../../api/collectionApi';
import SidebarHeader from '../shared/SidebarHeader';
import LibraryNavTree from './LibraryNavTree';
import CollectionTree from './CollectionTree';
import CollectionEditDialog from '../../Dialogs/CollectionEditDialog';
import DeleteCollectionDialog from '../../Dialogs/DeleteCollectionDialog';
import GroupEditDialog from '../../Dialogs/GroupEditDialog';
import CollectionContextMenu from './CollectionContextMenu';
import GroupContextMenu from './GroupContextMenu';
import { useCollectionDialogs } from './hooks';

// Helper to find sibling collection names
function findSiblingNames(
  treeData: CollectionTreeVO | undefined,
  groupId: number | undefined,
  parentId: number | undefined
): string[] {
  if (!treeData || !groupId) return [];

  const group = treeData.groups.find(g => g.id === groupId);
  if (!group) return [];

  if (parentId) {
    // Find parent collection and get its children's names
    const findInChildren = (collections: CollectionVO[]): string[] => {
      for (const c of collections) {
        if (c.id === parentId) {
          return c.children.map(child => child.name);
        }
        const found = findInChildren(c.children);
        if (found.length > 0) return found;
      }
      return [];
    };
    return findInChildren(group.collections);
  } else {
    // Top-level collections in this group
    return group.collections.map(c => c.name);
  }
}

const LibraryNav: React.FC = () => {
  const location = useLocation();
  const dialogs = useCollectionDialogs();

  // Data fetching
  const { data: readLaterCountData } = useQuery(
    ['read-later-count'],
    async () => (await PageControllerApiFactory().getReadLaterCountUsingGET()).data,
    { refetchInterval: 30000 }
  );

  const { data: treeData } = useQuery<CollectionTreeVO>(
    ['collections-tree'],
    async () => await CollectionApi.getTree(),
    { refetchInterval: 30000 }
  );

  // Calculate sibling names for duplicate validation
  const siblingNames = useMemo(() => {
    return findSiblingNames(treeData, dialogs.editingGroupId, dialogs.editingParentId);
  }, [treeData, dialogs.editingGroupId, dialogs.editingParentId]);

  return (
    <>
      <SidebarHeader title="Library" />
      <LibraryNavTree
        selectedNodeId={location.pathname}
        readLaterCount={readLaterCountData?.data}
      />

      <CollectionTree
        selectedNodeId={location.pathname}
        treeData={treeData || null}
        onCollectionContextMenu={dialogs.openCollectionMenu}
        onGroupContextMenu={dialogs.openGroupMenu}
      />

      {/* Dialogs */}
      <CollectionEditDialog
        open={dialogs.editDialogOpen}
        collection={dialogs.editingCollection}
        siblingNames={siblingNames}
        onClose={dialogs.closeEditDialog}
        onSave={dialogs.saveCollection}
      />

      <DeleteCollectionDialog
        open={dialogs.deleteDialogOpen}
        collection={dialogs.deletingCollection}
        onClose={dialogs.closeDeleteDialog}
        onConfirm={dialogs.confirmDelete}
      />

      <GroupEditDialog
        open={dialogs.groupEditDialogOpen}
        group={dialogs.editingGroup}
        onClose={dialogs.closeGroupEditDialog}
        onSave={dialogs.saveGroup}
      />

      {/* Context Menus */}
      <CollectionContextMenu
        contextMenu={dialogs.collectionContextMenu}
        onClose={dialogs.closeCollectionMenu}
        onEdit={dialogs.openEditCollection}
        onDelete={dialogs.openDeleteCollection}
        onAddSubCollection={dialogs.openAddSubCollection}
      />

      <GroupContextMenu
        contextMenu={dialogs.groupContextMenu}
        onClose={dialogs.closeGroupMenu}
        onEdit={dialogs.openEditGroup}
        onDelete={dialogs.deleteGroup}
        onAddCollection={dialogs.addCollectionFromGroup}
        onAddGroup={dialogs.openAddGroup}
      />
    </>
  );
};

export default LibraryNav;
