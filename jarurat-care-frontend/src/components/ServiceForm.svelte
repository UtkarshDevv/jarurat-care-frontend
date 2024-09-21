<script>
    import { createEventDispatcher } from 'svelte';
    const dispatch = createEventDispatcher();

    let name = '';
    let description = '';
    let price = '';

    let errors = {};

    function validate() {
        errors = {};
        if (!name.trim()) errors.name = 'Name is required.';
        if (!description.trim()) errors.description = 'Description is required.';
        if (!price || isNaN(price) || Number(price) <= 0) {
            errors.price = 'Valid price is required.';
        }
        return Object.keys(errors).length === 0;
    }

    function handleSubmit() {
        if (validate()) {
            dispatch('addService', { name, description, price: Number(price) });
            name = '';
            description = '';
            price = '';
        }
    }
</script>

<form on:submit|preventDefault={handleSubmit}>
    <div>
        <label for="name">Service Name:</label>
        <input id="name" bind:value={name} />
        {#if errors.name}
            <span class="error">{errors.name}</span>
        {/if}
    </div>
    <div>
        <label for="description">Description:</label>
        <textarea id="description" bind:value={description}></textarea>
        {#if errors.description}
            <span class="error">{errors.description}</span>
        {/if}
    </div>
    <div>
        <label for="price">Price (INR):</label>
        <input id="price" type="number" bind:value={price} />
        {#if errors.price}
            <span class="error">{errors.price}</span>
        {/if}
    </div>
    <button type="submit">Add Service</button>
</form>

<style>
    form {
        margin-bottom: 2rem;
        padding: 1rem;
        border: 1px solid #ccc;
        border-radius: 5px;
    }

    div {
        margin-bottom: 1rem;
    }

    label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: bold;
    }

    input, textarea {
        width: 100%;
        padding: 0.5rem;
        box-sizing: border-box;
    }

    .error {
        color: red;
        font-size: 0.875rem;
    }

    button {
        padding: 0.5rem 1rem;
        background-color: #2c3e50;
        color: white;
        border: none;
        border-radius: 3px;
        cursor: pointer;
    }

    button:hover {
        background-color: #34495e;
    }
</style>
