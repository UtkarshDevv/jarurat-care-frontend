<script>
    import { createEventDispatcher } from 'svelte';
    export let service;

    let isEditing = false;
    let editName = service.name;
    let editDescription = service.description;
    let editPrice = service.price;

    const dispatch = createEventDispatcher();

    function toggleEdit() {
        isEditing = !isEditing;
    }

    function handleUpdate() {
        if (editName.trim() && editDescription.trim() && editPrice > 0) {
            dispatch('updateService', {
                id: service.id,
                name: editName,
                description: editDescription,
                price: Number(editPrice)
            });
            isEditing = false;
        } else {
            alert('Please fill in all fields with valid data.');
        }
    }

    function handleDelete() {
        if (confirm(`Are you sure you want to delete "${service.name}"?`)) {
            dispatch('deleteService', service.id);
        }
    }
</script>

<li class="service-item">
    {#if isEditing}
        <div class="edit-form">
            <input bind:value={editName} placeholder="Service Name" />
            <textarea bind:value={editDescription} placeholder="Description"></textarea>
            <input type="number" bind:value={editPrice} placeholder="Price" />
            <button on:click={handleUpdate}>Save</button>
            <button on:click={toggleEdit}>Cancel</button>
        </div>
    {:else}
        <div class="service-details">
            <h3>{service.name}</h3>
            <p>{service.description}</p>
            <p><strong>Price:</strong> ${service.price.toFixed(2)}</p>
            <button on:click={toggleEdit}>Edit</button>
            <button on:click={handleDelete}>Delete</button>
        </div>
    {/if}
</li>

<style>
    .service-item {
        border: 1px solid #ddd;
        padding: 1rem;
        margin-bottom: 1rem;
        border-radius: 5px;
    }

    .service-details h3 {
        margin: 0 0 0.5rem 0;
    }

    .service-details p {
        margin: 0.25rem 0;
    }

    .service-details button {
        margin-right: 0.5rem;
        padding: 0.3rem 0.6rem;
        border: none;
        border-radius: 3px;
        cursor: pointer;
    }

    .service-details button:first-of-type {
        background-color: #f1c40f;
        color: white;
    }

    .service-details button:last-of-type {
        background-color: #e74c3c;
        color: white;
    }

    .edit-form input, .edit-form textarea {
        width: 100%;
        padding: 0.5rem;
        margin-bottom: 0.5rem;
        box-sizing: border-box;
    }

    .edit-form button {
        padding: 0.5rem 1rem;
        margin-right: 0.5rem;
        border: none;
        border-radius: 3px;
        cursor: pointer;
    }

    .edit-form button:first-of-type {
        background-color: #2ecc71;
        color: white;
    }

    .edit-form button:last-of-type {
        background-color: #95a5a6;
        color: white;
    }
</style>
