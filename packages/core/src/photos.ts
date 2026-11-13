import { supabase } from './supabase';

const bucket = 'restaurants';

// Given an restaurant, get the path of its logo.
function logoPath(restaurantId: string): string {
    return `${restaurantId}/logo.jpg`;
}

// Given an restaurant and one of its menu items, get the path of its photo.
function menuItemPhotoPath(restaurantId: string, itemId: string): string {
    return `${restaurantId}/menu/${itemId}/image.jpg`;
}

// Given just a storage path, get the full, actual URL.
function publicUrl(path: string): string {
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

// Anything that needs to know whether there is a picture there has to find out for itself.
export function logoUrl(restaurantId: string): string {
    return publicUrl(logoPath(restaurantId));
}

export function menuItemPhotoUrl(restaurantId: string, itemId: string): string {
    return publicUrl(menuItemPhotoPath(restaurantId, itemId));
}

// A dish photo fills a card and a logo is drawn at heading size.
const photoEdge = 1600;
const logoEdge = 800;
const quality = 0.82;

async function toJpeg(photo: Blob, longestEdge: number): Promise<Blob> {
    const bitmap = await createImageBitmap(photo, {
        imageOrientation: 'from-image',
    }).catch(() => {
        throw new Error('That file is not a photo this browser can read.');
    });

    const scale = Math.min(
        1,
        longestEdge / Math.max(bitmap.width, bitmap.height),
    );

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));

    const context = canvas.getContext('2d');

    if (context === null) {
        throw new Error('That photo could not be converted here.');
    }

    // JPEG has no transparency and an untouched canvas is transparent black, so
    // anything that was transparent - a PNG logo, which is most logos - would
    // arrive with a black field around it.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    bitmap.close();

    return await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (blob === null) {
                    reject(new Error('That photo could not be converted.'));
                } else {
                    resolve(blob);
                }
            },
            'image/jpeg',
            quality,
        );
    });
}

async function uploadPhoto(path: string, jpeg: Blob): Promise<void> {
    const { error } = await supabase.storage
        .from(bucket)
        .upload(path, jpeg, {
            contentType: 'image/jpeg',
            upsert: true,
        });

    if (error) {
        throw error;
    }
}

export async function writeLogo(restaurantId: string, photo: Blob): Promise<string> {
    await uploadPhoto(logoPath(restaurantId), await toJpeg(photo, logoEdge));

    return logoUrl(restaurantId);
}

export async function writeItemPhoto(
    restaurantId: string,
    itemId: string,
    photo: Blob,
): Promise<string> {
    await uploadPhoto(
        menuItemPhotoPath(restaurantId, itemId),
        await toJpeg(photo, photoEdge),
    );

    return menuItemPhotoUrl(restaurantId, itemId);
}
