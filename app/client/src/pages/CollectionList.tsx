import React, { useState, useEffect, useMemo } from "react";
import PageList from "../components/PageList";
import MainContainer from "../components/MainContainer";
import { useParams } from "react-router-dom";
import PageFilters, { PageFilterOptions } from "../components/PageFilters";
import { getPageListFilter } from "../domain/utils";
import { CollectionApi, Collection } from "../api/collectionApi";
import { NavLabel } from "../components/Navigation/shared/NavLabels";
import FolderIcon from "@mui/icons-material/Folder";
import InboxIcon from "@mui/icons-material/Inbox";
import { Icon } from "@iconify/react";
import { Box, SvgIconProps } from "@mui/material";

// Custom icon component for collections that can display emoji, iconify icons, or default folder
const CollectionIconComponent = React.forwardRef<SVGSVGElement, SvgIconProps & { collectionIcon?: string | null }>(
    ({ collectionIcon, ...props }, ref) => {
        if (!collectionIcon) {
            return <FolderIcon ref={ref} {...props} sx={{ color: '#f59e0b', ...props.sx }} />;
        }
        // Iconify icon (contains colon)
        if (collectionIcon.includes(':')) {
            return (
                <Box component="span" sx={{ display: 'flex', alignItems: 'center', ...props.sx }}>
                    <Icon icon={collectionIcon} width={24} height={24} />
                </Box>
            );
        }
        // Emoji
        return (
            <Box component="span" sx={{ fontSize: 20, lineHeight: 1, ...props.sx }}>
                {collectionIcon}
            </Box>
        );
    }
);
CollectionIconComponent.displayName = 'CollectionIconComponent';

const CollectionList = () => {
    const { id } = useParams<{ id: string }>();
    const [collection, setCollection] = useState<Collection | null>(null);
    const isUnsorted = id === 'unsorted';

    // Use SAVED_AT for unsorted (like My List), COLLECTED_AT for regular collections
    const [pageFilterOptions, setPageFilterOptions] = useState<PageFilterOptions>(() => ({
        defaultSortValue: isUnsorted ? 'SAVED_AT' : 'COLLECTED_AT',
        sortFields: [{
            value: isUnsorted ? 'SAVED_AT' : 'COLLECTED_AT',
            label: isUnsorted ? 'Recently saved' : 'Recently collected'
        }],
        asc: false,
    }));

    useEffect(() => {
        if (isUnsorted) {
            setCollection({ id: 0, name: "Unsorted", groupId: 0, displaySequence: 0 });
            setPageFilterOptions({
                defaultSortValue: 'SAVED_AT',
                sortFields: [{ value: 'SAVED_AT', label: 'Recently saved' }],
                asc: false,
            });
        } else if (id) {
            CollectionApi.getCollection(Number.parseInt(id))
                .then(coll => setCollection(coll))
                .catch(() => setCollection({ id: Number.parseInt(id), name: "Collection", groupId: 0, displaySequence: 0 }));
            setPageFilterOptions({
                defaultSortValue: 'COLLECTED_AT',
                sortFields: [{ value: 'COLLECTED_AT', label: 'Recently collected' }],
                asc: false,
            });
        }
    }, [id, isUnsorted]);

    function handleFilterChange(options: PageFilterOptions) {
        setPageFilterOptions(options);
    }

    // Build icon component based on collection's icon or default
    const IconComponent = useMemo(() => {
        if (isUnsorted) return InboxIcon;
        // Create a wrapper component that passes the collection icon
        const icon = collection?.icon;
        return React.forwardRef<SVGSVGElement, SvgIconProps>((props, ref) => (
            <CollectionIconComponent ref={ref} collectionIcon={icon} {...props} />
        ));
    }, [isUnsorted, collection?.icon]);

    const navLabel: NavLabel = {
        labelText: collection?.name || "Collection",
        labelIcon: IconComponent,
        linkTo: isUnsorted ? "/collection/unsorted" : `/collection/${id}`,
    };

    // Build filters including collectionId
    const filters: any = {
        ...getPageListFilter(pageFilterOptions),
        saveStatus: 'SAVED',
    };

    // For unsorted, use filterUnsorted flag
    // For specific collection, use collectionId
    if (isUnsorted) {
        filters.filterUnsorted = true;
    } else if (id) {
        filters.collectionId = Number.parseInt(id);
    }

    return (
        <MainContainer>
            <PageList
                navLabel={navLabel}
                filters={filters}
                buttonOptions={{ markRead: false }}
                filterComponent={<PageFilters options={pageFilterOptions} onChange={handleFilterChange} />}
            />
        </MainContainer>
    );
};

export default CollectionList;
