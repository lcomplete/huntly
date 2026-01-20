import React, { useState, useEffect, useMemo } from "react";
import PageList from "../components/PageList";
import MainContainer from "../components/MainContainer";
import { useParams } from "react-router-dom";
import PageFilters, { PageFilterOptions } from "../components/PageFilters";
import { getPageListFilter } from "../domain/utils";
import { CollectionApi, Collection } from "../api/collectionApi";
import { NavLabel } from "../components/Navigation/shared/NavLabels";
import FolderOutlinedIcon from "@mui/icons-material/FolderOutlined";
import InboxOutlinedIcon from "@mui/icons-material/InboxOutlined";
import { Icon } from "@iconify/react";
import { Box, SvgIconProps } from "@mui/material";

// Custom icon component for collections that can display emoji, iconify icons, or default folder
const CollectionIconComponent = React.forwardRef<SVGSVGElement, SvgIconProps & { collectionIcon?: string | null }>(
    ({ collectionIcon, ...props }, ref) => {
        if (!collectionIcon) {
            return <FolderOutlinedIcon ref={ref} {...props} />;
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

    // Use UNSORTED_SAVED_AT for unsorted (uses createdAt), COLLECTED_AT for regular collections
    const [pageFilterOptions, setPageFilterOptions] = useState<PageFilterOptions>(() => ({
        defaultSortValue: isUnsorted ? 'UNSORTED_SAVED_AT' : 'COLLECTED_AT',
        sortFields: [{
            value: isUnsorted ? 'UNSORTED_SAVED_AT' : 'COLLECTED_AT',
            label: isUnsorted ? 'Recently saved' : 'Recently collected'
        }],
        asc: false,
        includeArchived: true,
        includeArchivedOption: true,
    }));

    useEffect(() => {
        if (isUnsorted) {
            setCollection({ id: 0, name: "Unsorted", groupId: 0, displaySequence: 0 });
            setPageFilterOptions({
                defaultSortValue: 'UNSORTED_SAVED_AT',
                sortFields: [{ value: 'UNSORTED_SAVED_AT', label: 'Recently saved' }],
                asc: false,
                includeArchived: true,
                includeArchivedOption: true,
            });
        } else if (id) {
            CollectionApi.getCollection(Number.parseInt(id))
                .then(coll => setCollection(coll))
                .catch(() => setCollection({ id: Number.parseInt(id), name: "Collection", groupId: 0, displaySequence: 0 }));
            setPageFilterOptions({
                defaultSortValue: 'COLLECTED_AT',
                sortFields: [{ value: 'COLLECTED_AT', label: 'Recently collected' }],
                asc: false,
                includeArchived: true,
                includeArchivedOption: true,
            });
        }
    }, [id, isUnsorted]);

    function handleFilterChange(options: PageFilterOptions) {
        setPageFilterOptions(options);
    }

    // Build icon component based on collection's icon or default
    const IconComponent = useMemo(() => {
        if (isUnsorted) return InboxOutlinedIcon;
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

    // Build search keywords based on collection
    const searchKeywords = useMemo(() => {
        if (isUnsorted) {
            return ['unsorted'];
        }
        return [];
    }, [isUnsorted]);

    // Build search text for collection (advanced search)
    // Add trailing space so users can directly type additional keywords
    const searchText = useMemo(() => {
        if (!isUnsorted && collection?.name) {
            return `collection:${collection.name} `;
        }
        return undefined;
    }, [isUnsorted, collection?.name]);

    return (
        <MainContainer>
            <PageList
                navLabel={navLabel}
                filters={filters}
                buttonOptions={{ markRead: false }}
                filterComponent={<PageFilters options={pageFilterOptions} onChange={handleFilterChange} />}
                defaultSearchKeywords={searchKeywords}
                defaultSearchText={searchText}
            />
        </MainContainer>
    );
};

export default CollectionList;
