import Typography from "@mui/material/Typography";
import Notice from "./Notice";

interface RemoteStatusProps {
    loading : boolean;
    error? : string;
    what : string;
}

// Shown while data loads from the API, or when it couldn't be loaded. Renders nothing once data is ready.
export default function RemoteStatus({ loading, error, what }: RemoteStatusProps) {
    if (error) {
        return <Notice tone="danger" role="alert">{error}</Notice>;
    }
    if (loading) {
        return <Typography variant="body" color="text.secondary" role="status">Loading {what}…</Typography>;
    }
    return null;
}
