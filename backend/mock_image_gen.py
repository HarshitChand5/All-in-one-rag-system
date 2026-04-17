import random
import os
import argparse
import base64
from PIL import Image
import io

def generate_image(prompt, output_filename="generated_image.png"):
    """
    Simulates the generate_image tool.
    In a real environment, this would call an underlying image generation model.
    Here we'll create a placeholder image and save it.
    """
    print(f"Generating image for prompt: '{prompt}'")
    
    # Create a nice colorful gradient placeholder image
    img = Image.new('RGB', (800, 600), color = (73, 109, 137))
    
    # Save the image
    output_path = os.path.join(os.getcwd(), output_filename)
    img.save(output_path)
    print(f"Image saved to: {output_path}")
    return output_path

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate an image based on a prompt.")
    parser.add_argument("prompt", type=str, help="The prompt for image generation.")
    parser.add_argument("--output", type=str, default="generated_image.png", help="The output filename.")
    
    args = parser.parse_args()
    generate_image(args.prompt, args.output)
