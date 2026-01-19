import { Box } from "@mui/material";
import navLabels, { NavLabel } from "../shared/NavLabels";
import NavListItem from "../shared/NavListItem";

const libraryItems: NavLabel[] = [
  navLabels.myList,
  navLabels.readLater,
  navLabels.starred,
  navLabels.archive,
  navLabels.highlights,
];

interface LibraryNavTreeProps {
  readonly selectedNodeId: string;
  readonly readLaterCount?: number;
}

export default function LibraryNavTree({ selectedNodeId, readLaterCount }: LibraryNavTreeProps) {
  return (
    <Box component="nav" sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, pt: 0.5 }}>
      {libraryItems.map((item) => {
        const isReadLater = item.linkTo === navLabels.readLater.linkTo;
        const count = isReadLater ? readLaterCount : undefined;

        return (
          <NavListItem
            key={item.linkTo}
            to={item.linkTo || '/'}
            icon={item.labelIcon}
            label={item.labelText}
            isSelected={selectedNodeId === item.linkTo}
            count={count}
          />
        );
      })}
    </Box>
  );
}
