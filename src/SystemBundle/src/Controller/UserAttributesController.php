<?php

declare(strict_types=1);

namespace App\SystemBundle\Controller;

use App\SystemBundle\User\Entity\User;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Attribute\AsController;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Symfony\Component\Security\Http\Authentication\AuthenticationUtils;

#[AsController]
class UserAttributesController // extends AbstractController
{
    public function __construct()
    {
    }

    #[Route('/api/get-user-attributes', name: 'get_user_attributes')]
    public function login(Request $request, AuthenticationUtils $authenticationUtils, #[CurrentUser] User $user): JsonResponse
    {
        return new JsonResponse(['playerName' => $user->getUsername(), 'map' => []]);
    }
}
